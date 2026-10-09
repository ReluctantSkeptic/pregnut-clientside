(function () {
  var form = document.getElementById("ContactForm");
  if (!form) return;
  var started = document.getElementById("ContactStartedAt");
  var status = document.getElementById("ContactStatus");
  var submit = document.getElementById("ContactSubmit");
  var page = document.getElementById("ContactPage");
  started.value = String(Date.now());
  try {
    var ref = document.referrer ? new URL(document.referrer) : null;
    if (ref && ref.host === location.host) page.value = ref.pathname.slice(0, 200);
  } catch (e) {}

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = "contact-status" + (kind ? " is-" + kind : "");
  }

  // After /api/contact accepts and stores a message, it may hand back a
  // FormSubmit alias endpoint (no email address); the browser forwards the
  // message there so it arrives by email. The copy saved by /api/contact is
  // the backup, so a failed relay is logged but not shown as an error.
  function relay(body, data) {
    return fetch(body.relay.url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      referrerPolicy: "strict-origin",
      body: JSON.stringify({
        _subject: body.relay.subject,
        _replyto: data.email,
        _template: "box",
        _captcha: "false",
        Name: data.name || "(not given)",
        Email: data.email,
        Topic: data.topic,
        Message: data.message,
        Page: data.page || "/contact/",
        Received: body.relay.received,
        Reference: body.id
      })
    }).then(function (r) { return r.json(); }).then(function (r) {
      if (String(r && r.success) !== "true") throw new Error((r && r.message) || "relay failed");
    }).catch(function (error) {
      if (window.console) console.warn("Contact email relay failed; the message was still saved.", error && error.message);
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var email = form.elements.email.value.trim();
    var message = form.elements.message.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setStatus("Enter a valid email address so we can reply.", "error");
      form.elements.email.focus();
      return;
    }
    if (message.length < 10) {
      setStatus("Write a message of at least 10 characters.", "error");
      form.elements.message.focus();
      return;
    }
    submit.disabled = true;
    setStatus("Sending…");
    var data = {};
    new FormData(form).forEach(function (value, key) { data[key] = value; });
    fetch(form.action, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok || !body.ok) throw new Error(body.error || "Sorry, the message could not be sent. Please try again later.");
          if (body.relay && body.relay.url) return relay(body, data);
        });
      })
      .then(function () {
        form.reset();
        started.value = String(Date.now());
        setStatus("Thanks. Your message was sent.", "success");
      })
      .catch(function (error) {
        setStatus(error.message, "error");
      })
      .then(function () { submit.disabled = false; });
  });
})();
