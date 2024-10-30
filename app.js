const express = require('express');
const app = express();
const request = require('request');
const axios = require('axios');

const ngrok = require('ngrok');

require('dotenv').config();

app.use(express.json());


const port = process.env.PORT || 3000

const dayjs = require('dayjs');
const date = dayjs('2024-10-29T13:45:02');
const timestamp = date.format('YYYYMMDDHHmmss');
console.log("Timestamp:", timestamp);


const secret = process.env.CONSUMER_SECRET;
const consumer = process.env.CONSUMER_KEY;
const pass_key = process.env.PASS_KEY;
const short_code = process.env.SHORT_CODE;
const url = process.env.CREDENTIALS_URL;
const mpesa_url = process.env.MPESA_URL;
const stk_password = new Buffer.from(short_code + pass_key + timestamp).toString("base64");




// Define the function to set up Ngrok and get the full callback URL
const setupNgrok = async (port) => {
    try {
        // Start the Ngrok tunnel and get the base URL
        const baseUrl = await ngrok.connect(port);
        console.log("Ngrok tunnel created at:", baseUrl);

        // Append `/stk_callback` to form the full callback URL
        const callbackUrl = `${baseUrl}/stk_callback`;
        console.log("Callback URL for STK Push:", callbackUrl);

        return callbackUrl;
    } catch (error) {
        console.error("Error setting up Ngrok:", error);
        throw error;
    }
};

// Access token middleware
const generateToken = async (req, res, next) => {
    try {
        console.log("Consumer Key:", consumer);
        console.log("Consumer Secret:", secret);

        // Create the Basic Auth header
        const auth = Buffer.from(`${consumer}:${secret}`).toString('base64');

        // Make the Axios request to generate the access token
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });

        // Store the access token in the request object
        req.safaricom_access_token = response.data.access_token;
        next();
    } catch (error) {
        console.error("Access token error:", error.message);
        res.status(503).send({
            "message": 'Something went wrong when trying to process your payment',
            "error": error.message
        });
    }
};
// Access token route
app.get('/access_token', generateToken, (req, res) => {
    res.status(200).json({
        success: true,
        message: "Token generated successfully",
        token: req.safaricom_access_token, 
    });
});

// stk push
const stkPushRequest = async (req, res) => {
    try {
        // Extract amount, phone, and Order_ID from the request body
        const { amount, phone, Order_ID } = req.body;

        const authentication = "Bearer " + req.safaricom_access_token;
        console.log("Auth:", authentication);

        const callbackUrl = await ngrok.connect(port);
        console.log("Ngrok tunnel created at:", callbackUrl);

        const response = await axios.post(mpesa_url,
            {
                BusinessShortCode: short_code,
                Password: stk_password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: amount,  
                PartyA: phone,   
                PartyB: short_code,
                PhoneNumber: phone,  
                CallBackURL: callbackUrl,
                AccountReference: Order_ID,
                TransactionDesc: "Payment for Order ID: " + Order_ID             },
            {
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": authentication
                }
            }
        );

        console.log(response.data);
        res.status(200).json(response.data);
    } catch (error) {
        console.error("Error with STK push request:", error.message);
        res.status(503).json({
            message: 'Failed to process STK push request',
            error: error.message
        });
    }
};
//STK push route
app.post('/stk_push', generateToken, stkPushRequest);

// callback
const stkPushCallback = async (req, res) => {
    try {
        console.log("Full Callback Data:", JSON.stringify(req.body, null, 2));

        // Check if `Body` exists in the callback
        if (!req.body.Body) {
            throw new Error("Callback body structure invalid. 'Body' field not found.");
        }

        const {
            MerchantRequestID,
            CheckoutRequestID,
            ResultCode,
            ResultDesc,
            CallbackMetadata
        } = req.body.Body.stkCallback;

        // Continue with extracting CallbackMetadata items
        const metaItems = CallbackMetadata.Item;
        const PhoneNumber = metaItems.find(item => item.Name === 'PhoneNumber')?.Value.toString();
        const Amount = metaItems.find(item => item.Name === 'Amount')?.Value.toString();
        const MpesaReceiptNumber = metaItems.find(item => item.Name === 'MpesaReceiptNumber')?.Value.toString();
        const TransactionDate = metaItems.find(item => item.Name === 'TransactionDate')?.Value.toString();

        console.log("Processed Callback Data:", {
            MerchantRequestID,
            CheckoutRequestID,
            ResultCode,
            ResultDesc,
            PhoneNumber,
            Amount,
            MpesaReceiptNumber,
            TransactionDate
        });

        res.json({ success: true, message: "Callback received successfully" });
    } catch (error) {
        console.error("Error handling STK callback:", error.message);
        res.status(500).json({ success: false, message: "Callback processing error", error: error.message });
    }
};
//callback route
app.post('/stk_callback', stkPushCallback);

// confirmPayment
const confirmPayment = async (req, res) => {
    try {
        // const authentication = "Bearer " + req.safaricom_access_token;
        // console.log("Auth:", authentication);

        // Base64 encode the BusinessShortCode + PassKey + Timestamp
        const { CheckoutRequestID, authentication} = req.body;
        // const { CheckoutRequestID} = req.body;

        // Prepare the request body
        const requestBody = {
            BusinessShortCode: short_code,
            Password: stk_password,
            Timestamp: timestamp,
            CheckoutRequestID: CheckoutRequestID,
        };

        // Use axios for the HTTP request for better error handling and promise support
        const response = await axios.post(mpesa_url, requestBody, {
            headers: {
                "Authorization": authentication,
                "Content-Type": "application/json",
            },
        });

        // Send back the response from the STK push query
        res.status(200).json(response.data);
    } catch (error) {
        console.error("Error while trying to create LipaNaMpesa details", error);
        res.status(503).send({
            message: "Something went wrong while trying to create LipaNaMpesa details. Contact admin",
            error: error.message || error, // Provide a clear error message
        });
    }
};
app.post('/confirm_payment', confirmPayment);



// listen
app.listen(port, (err) => {
    if (err) {
        console.log(err)
    }
    console.log(`App listening on port ${port}`)
});


