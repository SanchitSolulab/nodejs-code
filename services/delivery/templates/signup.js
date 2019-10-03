const { webAppBaseUrl } = require('../../../config/config');

exports.email = data => `
   <html>
        <head>
        </head>
        <body>
            <h1> Welcome to Contestee ${data.firstName} ${data.lastName}</h1> 
            <h4> ${webAppBaseUrl} </h4>
            <h4> email: ${data.email} </h4>
            <h4> gender: ${data.gender} </h4>
        </body>
    
    </html>
    `;
