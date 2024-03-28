// import PDFGenerator
const PDFGenerator = require("./PDFGenerator");


module.exports = function AdminService(){

    this.on('generatePdf', async (req) =>
    {
        let pdfBuffer = await PDFGenerator.generatePDF();
        
        let filename = "generated.pdf"

        const forceDownload = true;
        const contentDisposition = forceDownload ? "attachment" : "inline";
        
        // Currently manipulating private headers and response due to limitations on CAP binary implementations
        req._.odataRes.setHeader("Content-Disposition", `${contentDisposition}; filename="${filename}"`);
        req._.odataRes.setHeader("Content-Type", "application/pdf");
        req._.odataRes.setHeader("Content-Length", pdfBuffer.length);
        req._.odataRes.end(Buffer.from(pdfBuffer, "binary"));
    })
}