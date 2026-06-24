
// Retrieve query params
const queries = new URLSearchParams(window.location.search);
// Show user errors
const error = queries.get("error");
if (error) document.querySelector("#fail").textContent = error;
// Show server error
const server = queries.get("server");
if (server) alert(`Server error: ${server}. If the error persists, please contact app administrators.`);