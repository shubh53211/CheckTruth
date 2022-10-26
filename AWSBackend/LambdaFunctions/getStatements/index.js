const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB.DocumentClient();

async function getStatements(title_str) {
    var params = {
        TableName : 'statements',
        FilterExpression: "contains(#title, :title_str)",
        ExpressionAttributeNames: {
            "#title": "title"
        },
        ExpressionAttributeValues: {
            ':title_str': title_str
        }    
    };
    
    console.log('getStatements: params:', JSON.stringify(params));
    var result = await dynamo.scan(params).promise()
    console.log('getStatements: response:', JSON.stringify(result));
    return result
}

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // get the statements
    try {
        var statementsResp = await getStatements(event.title)
        return statementsResp
    } catch (err) {
        return err
    }
};
