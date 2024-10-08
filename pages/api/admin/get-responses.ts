// pages/api/surveys/[id]/responses.js
//@ts-ignore
import jwt from 'jsonwebtoken';
//@ts-ignore
import cookie from 'cookie';
import { createClient } from '@vercel/postgres';
{/*@ts-ignore*/}



export default async function handler(req, res) {
    
  if (req.method !== 'GET') {
    return res.status(405).end('Method Not Allowed');
  }
  function auth() {
    try {
      const cookies = cookie.parse(req.headers.cookie || '');
      const token = cookies.token;
      if (!token) throw new Error();

      jwt.verify(token, process.env.JWT_SECRET);
      return true;
    } catch (err) {
      return false;
    }
  }

  const isAuthenticated = auth();
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const surveyId = req.query.id;
  const client = createClient();

  try {
    await client.connect();

    const query = `
  SELECT 
    u.user_name, u.surname, u.email, u.city, u.pharmacy, u.phone,
    q.questiontext, r.answertext
  FROM responses r
  JOIN users u ON r.userid = u.id
  JOIN questions q ON r.questionid = q.questionid
  WHERE r.formid = $1
  ORDER BY u.id, r.questionid
`;

    const { rows } = await client.query(query, [surveyId]);
    console.log("Survey ID:", surveyId);

    // Format responses
    const formattedResponses = rows.reduce((acc, row) => {
  const userKey = `${row.user_name}-${row.surname}`;
  if (!acc[userKey]) {
    acc[userKey] = {
      firstName: row.user_name,
      lastName: row.surname,
      email: row.email,
      city: row.city,
      pharmacy: row.pharmacy,
      phone: row.phone,
      responses: {}
    };
  }

  // Check if the question already has a response
  if (acc[userKey].responses[row.questiontext]) {
    // Concatenate this response with previous ones for the same question
    acc[userKey].responses[row.questiontext] += ` ; ${row.answertext}`;
  } else {
    // Add the first response for this question
    acc[userKey].responses[row.questiontext] = row.answertext;
  }

  return acc;
}, {});

// Convert the responses object into an array format
const finalResponses = Object.values(formattedResponses).map(user => ({
    //@ts-ignore
  ...user,
  //@ts-ignore
  responses: Object.entries(user.responses).map(([question, response]) => ({
    question,
    response
  }))
}));

res.status(200).json(finalResponses);

  } catch (error) {
    console.error('Error fetching survey responses:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    await client.end();
  }
}
