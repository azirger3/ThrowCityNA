const express = require('express');
const app = express();
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();
app.set('view engine', 'ejs'); // set the view engine to EJS
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.
app.use(express.static('resources'))

//Database setup
const dbConfig = {
    host: 'db', 
    port: 5432, 
    database: process.env.POSTGRES_DB, 
    user: process.env.POSTGRES_USER, 
    password: process.env.POSTGRES_PASSWORD, 
  };
const db = pgp(dbConfig);
db.connect() //realistically database will only get used later but it's here for that time
  .then(obj => {
    console.log('Database connection successful'); 
    obj.done(); 
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

app.get("/acctIDByAcctTag", (req, res) => {
    const username = req.body.username;
    const tag = req.body.tag;
    axios.get(`https://api.henrikdev.xyz/valorant/v1/account/${username}/${tag}`)
    .then(results => {
        console.log(results.data.data.puuid);
        res.status(201).json({
            status: 'success',
            data: results.data.data,
            message: 'data fetched successfully',
        });
    })
    .catch(error => {
        res.send(error);
    });
});

app.get("/matchByMatchID", (req, res) => {
    const mID = req.body.mID;
    axios.get(`https://api.henrikdev.xyz/valorant/v2/match/${mID}`)
    .then(results => {
        // Finding Agents used by A and B for NM W/L
        AAgents = [];
        BAgents = [];
        for(player in results.data.data.players.red) {
            AAgents.push(results.data.data.players.red[player].character);
        }
        for(player in results.data.data.players.blue) {
            BAgents.push(results.data.data.players.blue[player].character);
        }
        // Finding Winning/Losing Rounds + OT Rounds. Yes there is probably a better way of coding this before you ask why I did it this way.
        var AWins = 0;
        var AAtkWins = 0;
        var ADefWins = 0;
        var AOTWins = 0;
        var BWins = 0;
        var BAtkWins = 0;
        var BDefWins = 0;
        var BOTWins = 0;
        for (round in results.data.data.rounds) {
            if (round < 12) {
                if (results.data.data.rounds[round].winning_team == "Red") {
                    AWins++;
                    AAtkWins++;
                } else {
                    BWins++;
                    BDefWins++;
                }
            } else if (round < 24) {
                if (results.data.data.rounds[round].winning_team == "Red") {
                    AWins++;
                    ADefWins++;
                } else {
                    BWins++;
                    BAtkWins++;
                }
            } else {
                if (results.data.data.rounds[round].winning_team == "Red") {
                    AWins++;
                    AOTWins++;
                } else {
                    BWins++;
                    BOTWins++;
                }
            }
        }
        var rounds = AWins+BWins;
        var winner;
        if (AWins > BWins) {
            winner = 'A';
        } else if (AWins < BWins) {
            winner = 'B';
        }

        //Creating return data structure
        var returnData = {};
        // Creating top bar of spreadsheet
        var topBar = ['Players','Notes','Teams','Score','Attacking Rounds Won','Defending Rounds Won','OT Rounds Won','Agents Played','Agents that won','NM Agents that won','Agents that lost','NM Agents that lost','ACS','Kills','Deaths','Assists','K/D Ratio','KAST','FK','FD','Winners?']
        returnData.topBar = topBar;
        // Adding players to respective teams
        var TeamA = [];
        returnData.TeamA = TeamA;
        for(player in results.data.data.players.red) {
            var aW = '';
            var aNMW = '';
            var aL = '';
            var aNML = '';
            if (winner == 'A') {
                aW = results.data.data.players.red[player].character;
                if (!(BAgents.includes(results.data.data.players.red[player].character))) {
                    aNMW = results.data.data.players.red[player].character;
                }
            } else {
                aL = results.data.data.players.red[player].character;
                if (!(BAgents.includes(results.data.data.players.red[player].character))) {
                    aNML = results.data.data.players.red[player].character;
                }
            }

            var playerArr = [];
            playerArr.push(`${results.data.data.players.red[player].name} #${results.data.data.players.red[player].tag}`);
            playerArr.push('notes'); //remove notes at end, just for spacing
            playerArr.push('Team 1');
            playerArr.push(`${AWins}-${BWins}`);
            playerArr.push(AAtkWins);
            playerArr.push(ADefWins);
            playerArr.push(AOTWins);
            playerArr.push(results.data.data.players.red[player].character);
            playerArr.push(aW);
            playerArr.push(aNMW);
            playerArr.push(aL);
            playerArr.push(aNML);
            playerArr.push((results.data.data.players.red[player].stats.score/rounds).toFixed(0));
            playerArr.push(results.data.data.players.red[player].stats.kills);
            playerArr.push(results.data.data.players.red[player].stats.deaths);
            playerArr.push(results.data.data.players.red[player].stats.assists);
            playerArr.push((results.data.data.players.red[player].stats.kills/results.data.data.players.red[player].stats.deaths).toFixed(1));
            playerArr.push('KAST');
            playerArr.push('FK');
            playerArr.push('FD');
            playerArr.push('A' == winner);
            returnData.TeamA.push(playerArr);
        }
        var TeamB = [];
        returnData.TeamB = TeamB;
        for(player in results.data.data.players.blue) {
            var aW = '';
            var aNMW = '';
            var aL = '';
            var aNML = '';
            if (winner == 'B') {
                aW = results.data.data.players.blue[player].character;
                if (!(AAgents.includes(results.data.data.players.blue[player].character))) {
                    aNMW = results.data.data.players.blue[player].character;
                }
            } else {
                aL = results.data.data.players.blue[player].character;
                if (!(AAgents.includes(results.data.data.players.blue[player].character))) {
                    aNML = results.data.data.players.blue[player].character;
                }
            }

            var playerArr = [];
            playerArr.push(`${results.data.data.players.blue[player].name} #${results.data.data.players.blue[player].tag}`);
            playerArr.push('notes'); //remove notes at end, just for spacing
            playerArr.push('Team 2');
            playerArr.push(`${AWins}-${BWins}`);
            playerArr.push(BAtkWins);
            playerArr.push(BDefWins);
            playerArr.push(BOTWins);
            playerArr.push(results.data.data.players.blue[player].character);
            playerArr.push(aW);
            playerArr.push(aNMW);
            playerArr.push(aL);
            playerArr.push(aNML);
            playerArr.push((results.data.data.players.blue[player].stats.score/rounds).toFixed(0));
            playerArr.push(results.data.data.players.blue[player].stats.kills);
            playerArr.push(results.data.data.players.blue[player].stats.deaths);
            playerArr.push(results.data.data.players.blue[player].stats.assists);
            playerArr.push((results.data.data.players.blue[player].stats.kills/results.data.data.players.blue[player].stats.deaths).toFixed(1));
            playerArr.push('KAST');
            playerArr.push('FK');
            playerArr.push('FD');
            playerArr.push('B' == winner);
            returnData.TeamB.push(playerArr);
        }
        //console.log(returnData);
        console.log(AAgents);
        console.log(BAgents);
        console.log(results.data.data.players.blue[0].character);
        console.log((AAgents.includes(results.data.data.players.blue[0].character)));

        res.status(201).json({
            status: 'success',
            usefulData: returnData,
            data: results.data.data,
            message: 'data fetched successfully',
        });
    })
    .catch(error => {
        res.send(error);
    });
});

app.listen(3000);
console.log('Server is listening on port 3000');