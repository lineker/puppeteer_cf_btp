# Generating PDF on BTP using CAP and Puppeteer

In the midst of all the AI craziness once in a while there is a need to generate a PDF on the server side. Usually, you have two options: 

1. Use a PDF library where you need to set the position of each element, OR 
2. Generate HTML and then convert it to PDF. 

In this blog post, we will explore how to deploy an application on the Business Technology Platform (BTP) and use Puppeteer to generate PDFs.

**Prerequisites:**

Before we dive into the details, there are a few prerequisites that need to be in place. Firstly, you should have a BTP account and access to the Cloud Foundry environment. Additionally, you should have a basic understanding of Node.js and JavaScript. You should also install the following tools:

- Cloud Foundry CLI (https://docs.cloudfoundry.org/cf-cli/install-go-cli.html)
- MTA Build Tool (`npm install --global mbt`)
- MultiApps CF CLI Plugin (`cf install-plugin multiapps`)
- CDS (`npm install --global @sap/cds-dk`)

**Generating PDF:**

To generate PDFs using Puppeteer, we need to install the necessary dependencies. Create a new CAP Node.js project and navigate to the project directory in your terminal and install puppeteer.

```
cds init bookstore
cd bookstore
```

Before installing puppeteer lets create a configuration file to tell puppeter where to download chromium. Add a file name `.puppeteerrc.cjs` to the root of the project with the following content:

```json
const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};

```

Now we can install puppeteer

```bash
npm install puppeteer
```

Puppeteer is a Node.js library that provides a high-level API for controlling headless Chrome or Chromium browsers. It allows us to automate tasks such as generating PDFs by simulating user interactions on a webpage.

Next, create a new JavaScript file, let's call it `pdfGenerator.js`, and require the Puppeteer module at the top of the file:

```javascript
const puppeteer = require('puppeteer');
```

Inside the `PDFGenerator.js` file, we can define a function that generates a PDF. Let's call it `generatePDF`. Here's an example of how you can use Puppeteer to generate a PDF:

```javascript
static async generatePDF() {
    // Load sample HTML content from a file or somewhere else
    let htmlContent = await PDFGenerator.loadSampleHtmlFromFile();

    const browser = await puppeteer.launch({
        headless: "shell",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.setContent(htmlContent);

    // adding path: 'result.pdf' will save the pdf to the root of the project
    const pdf = await page.pdf({ format: "Letter" });

    await browser.close();
    return pdf;
}
```

In the above code, we first launch a new instance of the browser using `puppeteer.launch()`. Then, we create a new page and set the html content. We use `page.pdf()` to generate the PDF. We specify the format of the PDF (in this case, 'Letter').

Finally, we close the browser using `browser.close()`.

**Downloading PDF:**

Now that we have the code to generate the PDF, we can implement the CAP event handler to download the PDF. In the srv folder, add/modify the admin-service.cds file to add a new function that generates the PDF:

```
service AdminService @(requires:'any') { 
  function generatePdf () returns LargeBinary;
}
```
Next, implement the function in the admin-service.js file:

```javascript
const PDFGenerator = require("./PDFGenerator");


module.exports = function AdminService(){

    this.on('generatePdf', async (req) =>
    {
        let pdfBuffer = await PDFGenerator.generatePDF();
        
        let filename = "generated.pdf"

        const forceDownload = true;
        const contentDisposition = forceDownload ? "attachment" : "inline";
        
        req._.odataRes.setHeader("Content-Disposition", `${contentDisposition}; filename="${filename}"`);
        req._.odataRes.setHeader("Content-Type", "application/pdf");
        req._.odataRes.setHeader("Content-Length", pdfBuffer.length);
        req._.odataRes.end(Buffer.from(pdfBuffer, "binary"));
    })
```

In the above code, we call the `generatePDF` function and get the PDF buffer. We then set the response headers to force the browser to download the PDF file.  Finally, we end the response with the PDF buffer. If you set `forceDownload = false` the pdf will be presented in the browser.

You can test the application by running `cds run` and navigating to `localhost:4004/odata/v4/admin/generatePdf()`. This will download the generated PDF file.

> If you are using `cds watch` you will need to restart the server because the hot reload does not work well with binary data.

Now we are ready to deploy to BTP. To deploy the application to BTP we need to create a `mta.yaml` file in the root of the project. You can add a `mta.yaml` using the below command:

```bash
cds add mta
```

Lets also add the xsuaa service to the mta.yaml file:

```bash
cds add xsuaa --for production
```

Puppeteer requires dependencies that are not available in the default Node.js cf buildpack on BTP. To deploy the application and use Puppeteer, we need to use the `apt-buildpack` to install the dependencies needed. Add the following to the `apt.yaml` to the root of your project:

```yaml
---
packages:
- ca-certificates
- fonts-liberation
- libasound2
- libatk-bridge2.0-0
- libatk1.0-0
- libc6
- libcairo2
- libcups2
- libdbus-1-3
- libexpat1
- libfontconfig1
- libgbm1
- libgcc1
- libglib2.0-0
- libgtk-3-0
- libnspr4
- libnss3
- libpango-1.0-0
- libpangocairo-1.0-0
- libstdc++6
- libx11-6
- libx11-xcb1
- libxcb1
- libxcomposite1
- libxcursor1
- libxdamage1
- libxext6
- libxfixes3
- libxi6
- libxrandr2
- libxrender1
- libxss1
- libxtst6
- lsb-release
- wget
- xdg-utils
```

The list of dependencies might change with newer versions of Puppeteer. You can find the latest dependencies in the [Puppeteer documentation](https://pptr.dev/troubleshooting#chrome-doesnt-launch-on-linux).

Now lets change the `mta.yaml` to include the `apt-buildpack` and the `nodejs` buildpack. Add the following to the `mta.yaml`:

```yaml
We also need to increase the memory and disk space for the application. Add the following to the `mta.yaml`:

```yaml
- name: bookstore-srv
    type: nodejs
    path: gen/srv
    parameters:
      memory: 1024M
      disk-quota: 4096M
      buildpacks:
        - https://github.com/cloudfoundry/apt-buildpack
        - nodejs_buildpack
      readiness-health-check-type: http
      readiness-health-check-http-endpoint: /health
    build-parameters:
      ignore: ["node_modules/", "package-lock.json"]
      builder: custom
      commands:
        - echo "Building CAP service"
```

Notice that we also increase the default memory and disk quota for the application. This is because Puppeteer requires more memory and disk space to run.

Now we need to make sure the `apt.yml` and `.puppeteerrc.cjs` gets copied to the `gen/srv` during the build process. One way to do this is to modify the `mta.yaml`. Add the following to the `mta.yaml`:

```yaml
_schema-version: '3.1'
ID: bookstore
version: 1.0.0
description: "A simple CAP project"
parameters:
  enable-parallel-deployments: true
build-parameters:
  before-all:
    - builder: custom
      commands:
        - npx cds build --production
        - cp apt.yml gen/srv/
        - cp .puppeteerrc.cjs gen/srv/
        - npx rimraf gen/srv/node_modules
        - npx rimraf gen/srv/.cache
 ...
```

> **Make sure the `.cache` folder is not on `gen/srv` after your build the mtar**

The final gen folder should look like this:

- gen
  - db
  - srv
    - srv
    - apt.yml
    - .puppeteerrc.cjs

Now we are ready to build and deploy to BTP. Run the following commands to build and deploy the application:

```bash
mbt build
cf login
cf deploy mta_archives/bookstore_1.0.0.mtar
```

Now you can navigate to the deployed app on BTP and test the PDF generation functionality. 

```
https://<Your app domain>.cfapps.eu12.hana.ondemand.com/odata/v4/admin/generatePdf()
```

In this article learned how to generate PDFs using Puppeteer and how to deploy the application to BTP using multiple buildpacks (`apt-buildpack` and `nodejs`).

I hope you found this article helpful. If you have any questions or comments, please feel free to reach out to me.

You can find the source code for this article on [GitHub]()

Happy coding! 🚀