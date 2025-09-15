import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api", // always relative
  withCredentials: true, // keep if using cookies/sessions
});

export default api;