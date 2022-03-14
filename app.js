const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const dbPath = path.join(__dirname, "twitterClone.db");
app.use(express.json());

let db = null;

const initializeServerAndDB = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`Db Error : ${(e, message)}`);
    process.exit(1);
  }
};

initializeServerAndDB();

const authenticationJwtToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader != undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfghjkl", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//new user register API : 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 15);
  const passwordLength = password.length;
  const selectUserQuery = `SELECT *
    FROM
     user
    WHERE
     username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    if (passwordLength < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const registerUserQuery = `INSERT INTO
      user (name,username,password,gender)
      VALUES (
          '${name}',
          '${username}',
          '${hashedPassword}',
          '${gender}'
      );`;
      await db.run(registerUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//login API : 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT *
    FROM
     user
    WHERE
     username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser != undefined) {
    const isPasswordMach = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMach === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "asdfghjkl");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//get tweets of user follows API : 3
app.get(
  "/user/tweets/feed/",
  authenticationJwtToken,
  async (request, response) => {
    const username = request.username;

    const tweetsQuery = `SELECT
    user.username,
    tweet.tweet,
    tweet.date_time AS dateTime
    FROM 
     (follower INNER JOIN tweet ON following_user_id = tweet.user_id) AS T
     INNER JOIN user ON user.user_id = following_user_id
    
    WHERE 
     follower.follower_user_id = (SELECT user_id AS userId FROM user WHERE username = '${username}')
     ORDER BY tweet.date_time DESC
     LIMIT 4;`;
    const tweetsArray = await db.all(tweetsQuery);
    response.send(tweetsArray);
  }
);

//get names of people whom the user follows API : 4
app.get(
  "/user/following/",
  authenticationJwtToken,
  async (request, response) => {
    const username = request.username;

    const getFollowingQuery = `SELECT
    user.username AS name
    FROM 
     follower INNER JOIN user ON following_user_id = user.user_id 
    WHERE 
     follower.follower_user_id = (SELECT user_id AS userId FROM user WHERE username = '${username}');`;
    const followingArray = await db.all(getFollowingQuery);
    response.send(followingArray);
  }
);

//get names of people who follows the user API : 5
app.get(
  "/user/followers/",
  authenticationJwtToken,
  async (request, response) => {
    const username = request.username;

    const followersQuery = `SELECT
    user.username AS name
    FROM 
     follower INNER JOIN user ON follower_user_id = user.user_id 
    WHERE 
     follower.following_user_id = (SELECT user_id AS userId FROM user WHERE username = '${username}');`;
    const followersArray = await db.all(followersQuery);
    response.send(followersArray);
  }
);

//get tweets of user follows API : 6
app.get(
  "/tweets/:tweetId/",
  authenticationJwtToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const username = request.username;

    const verifyTweetQuery = `SELECT
    *
    FROM 
     follower INNER JOIN tweet ON following_user_id = tweet.user_id 
    WHERE 
     (follower.follower_user_id = (SELECT user_id AS userId FROM user WHERE username = '${username}'))
     AND tweet.tweet_id = ${tweetId};`;
    const followersArray = await db.get(verifyTweetQuery);
    if (followersArray === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getTweetStatsQuery = `SELECT 
      tweet.tweet AS tweet,
      count(DISTINCT like.like_id) AS likes,
      count(DISTINCT reply.reply_id) AS replies,
      tweet.date_time AS dateTime
      FROM 
       (reply INNER JOIN like ON reply.tweet_id = like.tweet_id) AS T
       INNER JOIN tweet ON tweet.tweet_id = T.tweet_id
      WHERE 
       reply.tweet_id = ${tweetId};`;

      const tweetStatus = await db.get(getTweetStatsQuery);
      response.send(tweetStatus);
    }
  }
);

//get likes of tweet user follows API : 7
app.get(
  "/tweets/:tweetId/likes/",
  authenticationJwtToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const username = request.username;

    const verifyTweetQuery = `SELECT
    *
    FROM 
     follower INNER JOIN tweet ON following_user_id = tweet.user_id 
    WHERE 
     (follower.follower_user_id = (SELECT user_id AS userId FROM user WHERE username = '${username}'))
     AND tweet.tweet_id = ${tweetId};`;
    const followersArray = await db.get(verifyTweetQuery);
    if (followersArray === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getTweetLikesQuery = `SELECT 
      
      DISTINCT user.username AS usersLikes
      
      FROM 
       (user INNER JOIN like ON user.user_id = like.user_id)
      WHERE 
       like.tweet_id = ${tweetId};`;

      const tweetLikesArrayObject = await db.all(getTweetLikesQuery);
      let namesArray = [];
      for (let eachObj of tweetLikesArrayObject) {
        namesArray.push(eachObj.usersLikes);
      }
      response.send({
        likes: namesArray,
      });
    }
  }
);

//get replies of tweet user follows API : 8
app.get(
  "/tweets/:tweetId/replies/",
  authenticationJwtToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const username = request.username;

    const verifyTweetQuery = `SELECT
    *
    FROM 
     follower INNER JOIN tweet ON following_user_id = tweet.user_id 
    WHERE 
     (follower.follower_user_id = (SELECT user_id AS userId FROM user WHERE username = '${username}'))
     AND tweet.tweet_id = ${tweetId};`;
    const followersArray = await db.get(verifyTweetQuery);
    if (followersArray === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getTweetRepliesQuery = `SELECT 
      user.username AS name,
      reply.reply AS reply
      FROM 
       (user INNER JOIN reply ON user.user_id = reply.user_id)
      WHERE 
       reply.tweet_id = ${tweetId};`;

      const tweetRepliesArrayObject = await db.all(getTweetRepliesQuery);
      let resultArray = [];
      for (let eachObj of tweetRepliesArrayObject) {
        resultArray.push(eachObj);
      }
      response.send({
        replies: resultArray,
      });
    }
  }
);

//get user tweets API : 9
app.get("/user/tweets/", authenticationJwtToken, async (request, response) => {
  const username = request.username;
  const getTweetsOfUserQuery = `SELECT 
      tweet.tweet,
      count (DISTINCT like.user_id) AS likes,
      count (DISTINCT reply.reply_id) AS replies,
      tweet.date_time AS dateTime
      FROM 
       (tweet LEFT JOIN like ON tweet.tweet_id = like.tweet_id) AS T
       LEFT JOIN reply ON reply.tweet_id = T.tweet_id
       
      WHERE 
       tweet.user_id = (SELECT user_id AS userId FROM user WHERE username = '${username}')
      GROUP BY tweet.tweet_id;`;
  const userTweets = await db.all(getTweetsOfUserQuery);
  response.send(userTweets);
});

//create a tweet API : 10
app.post("/user/tweets/", authenticationJwtToken, async (request, response) => {
  const username = request.username;
  const { tweet } = request.body;
  const userIdQuery = `SELECT user_id AS userId FROM user WHERE username = '${username}';`;
  const userId = await db.get(userIdQuery);

  const date = new Date();
  const postedDate = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;

  const createTweetQuery = `INSERT INTO
    tweet (tweet,user_id,date_time)
    VALUES (
        '${tweet}',
        ${userId.userId},
        '${postedDate}'
         );`;
  await db.run(createTweetQuery);
  response.send("Created a Tweet");
});

//delete  tweet of user  API : 11
app.delete(
  "/tweets/:tweetId/",
  authenticationJwtToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const username = request.username;
    const verifyTweetQuery = `SELECT
    *
    FROM 
     tweet 
    WHERE 
     (user_id = (SELECT user_id AS userId FROM user WHERE username = '${username}'))
     AND tweet_id = ${tweetId};`;
    const userTweet = await db.get(verifyTweetQuery);
    if (userTweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteTweetQuery = `DELETE FROM
      tweet
      WHERE 
       tweet_id = ${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;
