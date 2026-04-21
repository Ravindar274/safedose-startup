import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the SDK. It will automatically look for the GEMINI_API_KEY environment variable.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testConnection() {
    console.log("Connecting to the Gemini API...");
    
    try {
        // Using the same flash model you tested in your curl command
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = "Hello! I am calling you from a Node.js script using ES Modules. Are you receiving this?";

        // Send the request
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("\n--- Success! Response below ---");
        console.log(text);
        console.log("-------------------------------\n");

    } catch (error) {
        console.error("\nFailed to connect:");
        console.error(error.message);
        
        if (error.message.includes("API key not valid")) {
            console.log("\nTip: Make sure you ran the $env:GEMINI_API_KEY command in this exact terminal window.");
        }
    }
}

testConnection();