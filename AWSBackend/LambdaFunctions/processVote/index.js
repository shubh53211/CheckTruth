const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB.DocumentClient();

// async function abstraction
async function getStatement(statementCreatorId, statementId) {
  var params = {
    TableName: "statements",
    Key: {
        "creatorId": statementCreatorId,
        "statementId": statementId
    }
  }
  console.log('getStatement: params :', JSON.stringify(params));
  var statement = await dynamo.get(params).promise()
  console.log('getStatement: response :', JSON.stringify(statement));
  return statement
}

async function getVotes(statementCreatorId, statementId) {
    var params = {
        TableName: 'votes',
        KeyConditionExpression: 'statementCreatorId = :partitionKey and statementId = :sortKey',
        ExpressionAttributeValues: {
            ':partitionKey': statementCreatorId,
            ':sortKey': statementId
        }
    };

  console.log('getVotes: params:', JSON.stringify(params));
  var result = await dynamo.query(params).promise()
  console.log('getVotes: response:', JSON.stringify(result));
  return result
}


async function addVote(statementCreatorId, statementId, voterId, voteValue) {
    var vote = {
            "statementCreatorId": statementCreatorId,
            "statementId": statementId,
            "voterId": voterId,
            "voteValue": voteValue
    }
    var params = {
        TableName: "votes",
        Item: vote
    }
    console.log('addVote: params:', JSON.stringify(params));
    await dynamo.put(params).promise()
}

async function updateStatement(statement) {
    var params = {
        TableName: "statements",
        Item: statement
    }
    console.log('updateStatement: params:', JSON.stringify(params));
    await dynamo.put(params).promise()
}

async function getVoter(voterId) {
    var params = {
        TableName: "voters",
        Key: {
            "voterId": voterId
        }
    }
    console.log('getVoter: params:', JSON.stringify(params));
    var resp = await dynamo.get(params).promise();
    console.log('getVoter: response:', JSON.stringify(resp));
    
    if( !resp.hasOwnProperty("Item")) {
        // cannot find the voter
        console.log('getVoter: Voter does not exist: ', voterId);
        var voter = {
            "voterId": voterId,
            "reputation": 1.0
        }
        var params = {
            TableName: "voters",
            Item: voter
        }
        await dynamo.put(params).promise()
        return voter;
    }
    return resp.Item;
        // there is probably no voter with such ID; so we create this voter.
        
}

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // get the statement
    try {
        var statementResp = await getStatement(event.statementCreatorId, event.statementId)
        if( !statementResp.hasOwnProperty("Item")) {
            // cannot find the statement being voted on
            console.log('The statement does not exist.');
            return;
        }
        
        if( statementResp.Item.inActive == true ) {
            // the statement is not accepting new votes
            console.log('The Statement is no longer active.');
            return;
        }
        
        // check if this voter has already cast a vote on this statement
        var votesResp = await getVotes(event.statementCreatorId, event.statementId)
        for (var i = 0; i < votesResp.Count; i++) {
            var vote = votesResp.Items[i];
            //check if this vote was cast by our voter
            if( vote.voterId === event.voterId ) {
                // the voter has already voted on this statement
                console.log('The voter has already voted on this Statement.');
                return;    
            }
        }

        // store the vote in "votes" table
        await addVote(event.statementCreatorId, event.statementId, event.voterId, event.vote);
        
        // get the voter (create it if it does not exist)
        var voter = await getVoter(event.voterId)
        console.log('Voter:', JSON.stringify(voter, null, 2));
        
        // update the statement
        var statement = statementResp.Item;
        statement.numVotes += 1;
        statement.sumVotes += event.vote;
        statement.numWeightedVotes += voter.reputation;
        statement.sumWeightedVotes += (voter.reputation) * (event.vote);
        
        // store the updated statement in the table
        await updateStatement(statement);
        return statement
    } catch (err) {
        return err
    }
};
