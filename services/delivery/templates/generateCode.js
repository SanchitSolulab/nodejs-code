
exports.email = data => `
   <html>
        <head>
        </head>
        <body>
            <h1> code : ${data.code} </h1> 
            <h2> codeExpiry : ${data.codeExpiry} </h1>
        </body>
    
    </html>
    `;
