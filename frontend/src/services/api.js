import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 15000
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem("veloop_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(response => response, error => {
  // express-rate-limit returns plain text by default; normalize it so page-level
  // error states can show the server's useful message instead of a generic one.
  if (typeof error.response?.data === "string") {
    error.response.data = { message: error.response.data };
  }
  return Promise.reject(error);
});

export default api;
