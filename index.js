// IMPORTANT:
// if you're using the EU endpoint, use https://eu.api.fpjs.io URL instead.
const API_URL = 'https://api.fpjs.io';
const COOKIE_DURATION_DAYS = 365;
const COOKIE_DURATION_MS = COOKIE_DURATION_DAYS * 24 * 60 * 60 * 1000;
// This cookie name will be used to store the visitorID
// cookie will be set by Cloudflare worker in a 1st party context (http-only and secure)
const COOKIE_NAME = '__cflvid';
// A special visitorID that's used in situations when a visitorID
// should not be generated (throttled requests, search bots, unauthorized requests etc)
const VISITOR_ID_NA = 'n/a';

function generateResponseCookie(visitorId) {
  if (!visitorId || VISITOR_ID_NA === visitorId) {
    return;
  }
  const nameValue = `${COOKIE_NAME}=${visitorId}`;
  const path = 'path=/';
  const date = new Date();
  date.setTime(date.getTime() + COOKIE_DURATION_MS);
  const expires = `expires=${date.toUTCString()}`;
  return [nameValue, path, expires, 'HttpOnly', 'Secure'].join('; ');
}

/**
 * Grabs the cookie with name from the request headers
 * @param {Request} request incoming Request
 * @param {string} name of the cookie to grab
 * https://developers.cloudflare.com/workers/templates/pages/cookie_extract/
 */
function getCookie(request, name) {
  let result = '';
  const cookieString = request.headers.get('Cookie');
  if (cookieString) {
    const cookies = cookieString.split(';');
    cookies.forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim();
      if (cookieName === name) {
        const cookieVal = cookie.split('=')[1];
        result = cookieVal;
      }
    })
  }
  return result;
}

async function handleRequest(request) {
  try {
    const remoteClientIP = request.headers.get('CF-Connecting-IP');
    const headers = Object.fromEntries(request.headers.entries());
    // I'm using a non-standard header,
    // because CF overwrites standard headers with their IPs
    headers['Remote-Client-IP'] = remoteClientIP;
    const requestCookie = getCookie(request, COOKIE_NAME);
    if (requestCookie) {
      headers['Cfl-Vid'] = requestCookie;
    }
    const apiRequest = new Request(API_URL, {
      ...request,
      headers
    });
    const apiResponse = await fetch(apiRequest);
    const response = apiResponse.clone();
    if (apiResponse.headers.get('Content-Type') === 'application/json') {
      const responseJson = apiResponse.json();
      const responseCookie = generateResponseCookie(responseJson.visitorId);
      if (responseCookie) {
        response.headers.set('Set-Cookie', responseCookie);
      }
    }
    return response;
  } catch (error) {
    return new Response(
      JSON.stringify({
        visitorId: VISITOR_ID_NA,
        reason: error.message
      }), {
        status: 500
      }
    );
  }
}

addEventListener('fetch', event => {
  const { request } = event;
  event.respondWith(handleRequest(request));
});
