const twilio = require('twilio');
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

const generateMessage = (recipient) => {
    return `, ${recipient.name}! This is a message from Godabari Municipality for the vaccination of your child. Please visit the nearest health post for the vaccination  on 11:00 AM 2081-10-17. \n Thank you!`;
};




const sendBulkSMS = async (recipients ) => {

     try {
     recipients.forEach(async (recipient) => {
   
        const message = await client.messages.create({
                    body: generateMessage(recipient),
                    from: process.env.TWILIO_PHONE_NUMBER, 
                    to: `+977${recipient.phone}` ,
                  });

   console.log(`Message sent to ${recipient.phone}: ${message.sid}`);
   
     });
      } catch (error) {
    console.error(`Failed to send message to ${recipients.phone}: ${error.message}`);
 }

    


}

module.exports = { sendBulkSMS };


