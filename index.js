// This cookie name will be used to store the visitorID
// cookie will be set by Cloudflare worker in a 1st party context (http-only and secure)
const CookieKey = "__cflvid";

// A special visitorID that's used in situations when a visitorID 
// should not be generated (throttled requests, search bots, unauthorized requests etc)
const VisitorIdNa = "n/a";

addEventListener('fetch', event => {
  try {
    event.respondWith(handleRequest(event.request))
  } catch (e) {
    event.respondWith(`{"visitorId": "${VisitorIdNa}", "reason": "${e.message}"}`)
  }
});

async function handleRequest(request) {
  const remoteClientIP = request.headers.get("CF-Connecting-IP")

  const apiUrl = "https://api.fpjs.io";

  const headers = {
    "Connection": "keepalive",
    "Content-Type": "application/json",
    // I'm using a non-standard header, 
    // because CF overwrites standard headers with their IPs
    "Remote-Client-IP": remoteClientIP,
    "User-Agent": request.headers.get("User-Agent")
  };



  const cookieValue = getRequestCookieValue(request.headers.get("Cookie"), CookieKey);
  if (cookieValue) {
    headers["Cfl-Vid"] = cookieValue;
  }

  const apiRequest = new Request(apiUrl, {
    method: "POST",
    body: request.body,
    headers: headers
  });


  let apiResponse = await fetch(apiRequest);

  let responseJson = await apiResponse.json();

  let responseHeaders = { "Content-Type": "application/json" };

  const responseCookie = generateResponseCookie(responseJson.visitorId);
  if (responseCookie) {
    responseHeaders["Set-Cookie"] = responseCookie;
  }

  return new Response(JSON.stringify(responseJson), {
    headers: responseHeaders
  });
}

function getRequestCookieValue(rawCookieHeader, key) {
  let value = null;
  if (!rawCookieHeader || rawCookieHeader === "") {
    return value;
  }
  let pairs = rawCookieHeader.split(/;\s?/);
  if (pairs.length === 0) {
    return value;
  }
  pairs.forEach(pair => {
    let [currentKey, currentValue] = pair.split("=");

    if (currentKey === key) {
      value = currentValue;
      return;
    }
  });
  return value;
}

function generateResponseCookie(visitorId) {
  if (VisitorIdNa === visitorId) {
    return;
  }
  const cookieDurationDays = 365;
  const nameValue = `${CookieKey}=${visitorId}`;
  const path = "path=/";
  var date = new Date();
  date.setTime(date.getTime() + (cookieDurationDays * 24 * 60 * 60 * 1000));
  let expires = `expires=${date.toUTCString()}`;
  return [nameValue, path, expires, "HttpOnly", "Secure"].join("; ");
}
