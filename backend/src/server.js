import app from "./app.js";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST;

app.listen(host ? { port, host } : { port });
