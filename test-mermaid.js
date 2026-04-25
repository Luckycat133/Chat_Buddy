import mermaid from 'mermaid';
async function test() {
    try {
        console.log("Parsing...");
        await mermaid.parse("graph TD\nA --> B\ninvalid syntax");
        console.log("Parse succeeded (unexpected)");
    } catch (e) {
        console.log("Parse threw:", e.message);
    }
}
test();
