const { events, Job, Group } = require('brigadier')

events.on("push", (brigadeEvent, project) => {

    var acrServer = project.secrets.acrServer
    var acrName = project.secrets.acrName
    var azServicePrincipal = project.secrets.azServicePrincipal
    var azClientSecret = project.secrets.azClientSecret
    var azTenant = project.secrets.azTenant
    var gitPayload = JSON.parse(brigadeEvent.payload)
    var today = new Date()

    var gitSHA = brigadeEvent.revision.commit.substr(0,7)
    var imageTag = String(gitSHA)

    var frontend = new Job("job-runner-frontend")
    frontend.storage.enabled = false
    frontend.image = "microsoft/azure-cli"
    frontend.tasks = [
        `cd /src/frontend`,
        `az login --service-principal -u ${azServicePrincipal} -p ${azClientSecret} --tenant ${azTenant}`,
        `az acr build -t frontend:${imageTag} --build-arg REACT_APP_SHA=${gitSHA} -f ./Dockerfile . -r ${acrName}`
    ]


    var frontend_helm = new Job("job-runner-frontend-helm")
    frontend_helm.storage.enabled = false
    frontend_helm.image = "lachlanevenson/k8s-helm:v2.8.2"
    frontend_helm.tasks = [
        `helm upgrade --install --reuse-values frontend ./src/Charts/frontend --set image=${acrServer}/frontend --set imageTag=${imageTag}`
    ]

    var api = new Job("job-runner-api")
    api.storage.enabled = false
    api.image = "microsoft/azure-cli"
    api.tasks = [
        `cd /src/api`,
        `az login --service-principal -u ${azServicePrincipal} -p ${azClientSecret} --tenant ${azTenant}`,
        `az acr build -t api:${imageTag} -f ./Dockerfile . -r ${acrName}`
    ]

    var test_api = new Job("job-runner-test-api")
    api.storage.enabled = false
    api.image = "microsoft/azure-cli"
    api.tasks = [
        `cd /src/api`,
        `az login --service-principal -u ${azServicePrincipal} -p ${azClientSecret} --tenant ${azTenant}`,
        `az acr build -t api:${imageTag} -f ./Dockerfile . -r ${acrName}`
    ]

    var frontend_api = new Job("job-runner-api-helm")
    frontend_api.storage.enabled = false
    frontend_api.image = "lachlanevenson/k8s-helm:v2.8.2"
    frontend_api.tasks = [
        `helm upgrade --install --reuse-values api ./src/Charts/api --set image=${acrServer}/api --set imageTag=${imageTag}`
    ]

    var importer = new Job("job-runner-importer")
    importer.storage.enabled = false
    importer.image = "microsoft/azure-cli"
    importer.tasks = [
        `cd /src/importer_batch`,
        `az login --service-principal -u ${azServicePrincipal} -p ${azClientSecret} --tenant ${azTenant}`,
        `az acr build -t importer:${imageTag} -f ./Dockerfile . -r ${acrName}`
    ]


    Group.runEach([frontend, frontend_helm])
    Group.runEach([api, frontend_api])
    //Group.runEach([importer, frontend_helm])

})

