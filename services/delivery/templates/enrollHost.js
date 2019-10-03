const { webAppBaseUrl } = require('../../../config/config');

exports.email = data => `
   <html>
        <head>
        </head>
        <body>
            <h1>Hello ${data.firstName} ${data.lastName},</h1> 
            <p>You have enroll for host successfully, please wait till admin approves your request.</p>
        </body>
    
    </html>
    `;
