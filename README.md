# Brigide demo at Kubernetes London meetup



## Setup Brigade Environment

### Install Brigade on Cluster

Add the Brigade repo to your Helm environment.

```bash
helm repo add brigade https://azure.github.io/brigade

```

Deploy Brigade onto your cluster.

```bash
helm install -n brigade brigade/brigade --set rbac.enabled=false --set api.service.type=LoadBalancer
```

This will expose the Brigade endpoints on the Public Internet.  This is NOT advisable.  Check out the Brigade docs on either port-forwarding or securing the endpoints with SSL ingress.


## Install brig cli

```bash
cd $GOPATH/src/github.com/
git clone https://github.com/Azure/brigade.git
cd brigade
make bootstrap brig
cp bin/brig ~/bin
```

## Install Kashti

### Get Brigade API endpoint

Kashti will pull information from the Brigade API endpoint.  Check the exposed Service and note the EXTERNAL-IP

```bash
kubectl get svc

NAME                        TYPE           CLUSTER-IP     EXTERNAL-IP     PORT(S)          AGE
brigade-brigade-api         LoadBalancer   10.0.245.90    23.100.23.62    7745:31597/TCP   1h
```

### Deploy Kashti


```bash
curl https://github.com/Azure/kashti/archive/v0.2.0.tar.gz -o kashti-0.2.0.tar.gz
tar -zxvf kashti-0.2.0.tar.gz
cd kashti-0.2.0
```

```bash
helm install -n kashti ./charts/kashti --set service.type=LoadBalancer --set brigade.apiServer=http://23.100.23.62:7745
```


## Setup Azure Service Principal

As part of the build process, we will use the az cli Docker image to authenticate against the Azure API and then call *az acr build*.  For this, create a new Service Principal and note down the AppID, Password and Tenant for later use.

```bash
az ad sp create-for-rbac
```

### Test that you can authenticate

```bash
az login --service-principal -u 0d279bf8-{snip}-9cd2ca77a284 -p faf9acbc-{snip}-c654c96f2b22 --tenant 72f988bf-{snip}-2d7cd011db47
```


## Create GitHub token
Goto [https://github.com/settings/tokens/new](https://github.com/settings/tokens/new) and create a new Token to use for this Gateway. 



## Setup ACR and create Secret

For this demo we will be using ACR Build to build our images, as well as push to our private Azure Container Registry.

Get the admin credentials from the Azure portal and create a Kubernetes secret (this will be used for the ImagePullSecret in our deployment)

```bash
kubectl create secret docker-registry acr-secret --docker-server=inklin.azurecr.io --docker-username=inklin --docker-password=nV8oqk-{snip}-GR4J+ReHtK1Evc --docker-email=juda@microsoft.com
```



## Install project Chart
Edit the file inklin.yml to include the Service Principal created earlier, as well as setting the name and FQDN of the ACR instance to use for the build and storage of Images.

You will also need to create a GitHub token with repo admin rights

```yaml
project: "justindavies/inklin"
repository: "github.com/justindavies/inklin"
cloneURL: "https://github.com/justindavies/inklin"
sharedSecret: "MySuperSecretPassword"
github:
    token: "THIS_IS_YOUR_GH_SECRET"
secrets:
    acrServer: "inklin.azurecr.io"
    acrName: "inklin"
    azServicePrincipal: "0d279bf8-{snip}-9cd2ca77a284"
    azClientSecret: "faf9acbc-3055-{snip}-c96f2b22"
    azTenant: "72f988bf-{snip}-2d7cd011db47"
```

## Create Event Pipeline

Once saved, use helm to deploy the Brigade project.  This will also save your sensitive (secrets) that have been defined within the project, and accesible through your pipeline.


```bash
helm install --name inklin brigade/brigade-project -f inklin.yaml
```


## Setup GitHub webhook

```bash
kubectl get svc
NAME                        TYPE           CLUSTER-IP     EXTERNAL-IP     PORT(S)          AGE
brigade-brigade-github-gw   LoadBalancer   10.0.108.225   168.61.49.110   7744:32309/TCP   43m
```

Edit the repository properties and add a webhook for http://{IP}:7744/events/github, choose Content type of JSON, set the shared secret (that you specified in the project definition)

# Setup brigade.js in your repository

Now let's dive into the [brigade.js](https://github.com/justindavies/inklin/blob/master/brigade.js) configuration, build and deploy...