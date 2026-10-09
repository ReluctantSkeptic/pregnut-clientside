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
