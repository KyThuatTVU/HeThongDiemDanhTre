import { api } from './http.js';
import { DASHBOARD_URL, LOGIN_URL } from './config.js';

try {
    await api.get('/auth/me');
    window.location.replace(DASHBOARD_URL);
} catch {
    window.location.replace(LOGIN_URL);
}
