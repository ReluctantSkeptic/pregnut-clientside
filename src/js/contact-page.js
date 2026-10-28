// Contact page: posts to the shared site-contact Worker, which emails admin@yuriystasyuk.com.
(function () {
  var form = document.querySelector("[data-contact]");
  if (!form) return;
  var sel = form.querySelector("select[name=location]");
  var flag = form.querySelector(".cx-flag");
  var codes = "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BA BW BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VA VE VN VG VI WF EH YE ZM ZW".split(" ");
  var names = window.Intl && Intl.DisplayNames ? new Intl.DisplayNames([navigator.language || "en"], { type: "region" }) : null;
  var toFlag = function (c) { return String.fromCodePoint.apply(null, c.split("").map(function (ch) { return 127397 + ch.charCodeAt(0); })); };
  var list = codes.map(function (c) { var n = c; try { n = names ? names.of(c) : c; } catch (e) {} return [c, n]; });
  list.sort(function (a, b) { return a[1].localeCompare(b[1]); });
  var region = ((navigator.language || "").split("-")[1] || "US").toUpperCase();
  if (codes.indexOf(region) < 0) region = "US";
  list.forEach(function (it) { var o = document.createElement("option"); o.value = it[1]; o.dataset.code = it[0]; o.textContent = it[1]; if (it[0] === region) o.selected = true; sel.appendChild(o); });
  var sync = function () { var o = sel.selectedOptions[0]; flag.textContent = o ? toFlag(o.dataset.code) : ""; };
  sel.addEventListener("change", sync); sync();

  var started = Date.now();
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var status = form.querySelector("[role=status]");
    var button = form.querySelector("button[type=submit]");
    var d = Object.fromEntries(new FormData(form));
    button.disabled = true; status.textContent = "Sending…";
    try {
      var name = (d.first + " " + d.last).trim(), msg = "Location: " + d.location + "\n\n" + d.message;
      // /api/contact keeps a copy (with its own timing and rate checks); the Worker emails admin@yuriystasyuk.com.
      var saved = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, email: d.email, topic: "General question", message: msg, page: "/contact/", website: d.website, started_at: String(started) }) });
      var sb = await saved.json().catch(function () { return {}; });
      if (!saved.ok || !sb.ok) throw new Error(sb.error || "Sorry, the message could not be sent. Please try again later.");
      var res = await fetch("https://site-contact.ystasyuk.workers.dev", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: (d.first + " " + d.last).trim(), email: d.email, message: "Location: " + d.location + "\n\n" + d.message, website: d.website, site: location.href })
      });
      var out = await res.json();
      if (!out.ok) throw new Error(out.error);
      form.reset(); sync(); started = Date.now();
      status.textContent = "Thanks. Your message is on its way.";
    } catch (err) {
      status.textContent = (err && err.message) || "Couldn't send. Email admin@yuriystasyuk.com directly.";
    } finally { button.disabled = false; }
  });
})();
