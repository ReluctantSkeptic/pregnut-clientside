(function () {
  "use strict";

  var key = "pregnut.analytics.choice";
  var tagId = "G-17NKX3R956";
  var choice;
  try { choice = localStorage.getItem(key); } catch (error) {}

  function loadAnalytics() {
    if (document.getElementById("PregNutAnalyticsTag")) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", tagId);
    var script = document.createElement("script");
    script.id = "PregNutAnalyticsTag";
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + tagId;
    document.head.appendChild(script);
  }

  function clearAnalyticsCookies() {
    document.cookie.split(";").forEach(function (part) {
      var name = part.split("=")[0].trim();
      if (name !== "_ga" && name.indexOf("_ga_") !== 0) return;
      document.cookie = name + "=; Max-Age=0; path=/";
      document.cookie = name + "=; Max-Age=0; path=/; domain=" + location.hostname;
      document.cookie = name + "=; Max-Age=0; path=/; domain=." + location.hostname;
    });
  }

  if (choice === "accepted") loadAnalytics();

  function ready() {
    var banner = document.getElementById("CookieBanner");
    var settings = document.getElementById("CookieSettings");
    if (!banner || !settings) return;
    banner.hidden = choice === "accepted" || choice === "rejected";
    settings.addEventListener("click", function () {
      document.documentElement.classList.remove("has-analytics-choice");
      banner.hidden = false;
    });
    document.getElementById("CookieAccept").addEventListener("click", function () {
      try { localStorage.setItem(key, "accepted"); } catch (error) {}
      choice = "accepted";
      document.documentElement.classList.add("has-analytics-choice");
      banner.hidden = true;
      loadAnalytics();
    });
    document.getElementById("CookieReject").addEventListener("click", function () {
      try { localStorage.setItem(key, "rejected"); } catch (error) {}
      var hadAnalytics = choice === "accepted";
      choice = "rejected";
      document.documentElement.classList.add("has-analytics-choice");
      banner.hidden = true;
      clearAnalyticsCookies();
      if (hadAnalytics) window.location.reload();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();
