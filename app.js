const express = require('express');
const app = express();
const request = require('request');
const axios = require('axios');
require('dotenv').config();



app.get('/', (req,res)=>{
    res.send("Welcome")
});

//  Access token route
app.get('/access_token', generateToken, (req, res) => {
    res.status(200).json({
        success: true,
        message: "Token generated successfully",
        token: req.token
    });
});  

//  Access token
const generateToken = async (req,res,next) => {

    const secrete = process.env.consumer_secret
    const consumer = process.env.consumer_key
    
    console.log(secrete);
    console.log(consumer);

    const auth = new Buffer.from(`${consumer}:${secrete}`).toString("base64")

    await axios.get(
        "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",{
        headers:{
            authorization : `Basic ${auth}`
        }
    })
    .then((response) => {

        req.token = response.data.access_token

        next()
    })
    .catch((err) => {

        console.log(err)

    })
};

// Mpesa STK push
// azpp.get("/stkpush", (req, res) =>{
//     generateToken()
//     .then((accessToken) => {
//         const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
//         auth = "Bearer " + accessToken;
//         var timestamp = moment().format("YYYYMMDDHHmmss");
//         const password = new Buffer.from(
//             "" + "" + timestamp
//         ).toString("base64");
//         request()
//         )
//     })


// })





// listen
app.listen(3000, (err, live)=> {
    if(err){
        console.log(err)
    }
    console.log("Server running on port 3000")
});
