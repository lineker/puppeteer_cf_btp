const puppeteer = require("puppeteer");

class PDFGenerator {

  static async loadSampleHtmlFromFile() {
    const fs = require("fs");
    const path = require("path");

    const filePath = path.join(__dirname, "sample.html");
    
    // Read the file
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

  }

  static async generatePDF() {
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
}

module.exports = PDFGenerator;
