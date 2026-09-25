(function () {
  var tool = document.querySelector("[data-food-portion]");
  if (!tool) return;

  var input = tool.querySelector("#food-portion-grams");
  var error = tool.querySelector("#food-portion-error");
  var status = tool.querySelector("[data-food-portion-status]");
  var results = tool.querySelector(".food-portion-results");
  var rows = tool.querySelectorAll("[data-food-portion-row]");

  function format(value) {
    return String(Number(value.toFixed(2)));
  }

  function update() {
    var grams = Number(input.value);
    var valid = input.value !== "" && Number.isFinite(grams) && grams >= 0.1 && grams <= 5000;
    error.textContent = valid ? "" : "Enter a weight from 0.1 to 5,000 grams.";
    error.hidden = valid;
    status.hidden = !valid;
    results.hidden = !valid;
    input.setAttribute("aria-invalid", valid ? "false" : "true");
    if (!valid) return;

    status.textContent = "Estimated amounts for " + format(grams) + " g";
    rows.forEach(function (row) {
      var multiplier = grams / 100;
      var amount = Number(row.dataset.baseValue) * multiplier;
      var percent = Number(row.dataset.basePercent) * multiplier;
      row.querySelector("[data-food-portion-value]").textContent = format(amount);
      row.querySelector("[data-food-portion-percent]").textContent = String(Math.round(percent));
    });
  }

  tool.hidden = false;
  input.addEventListener("input", update);
  update();
})();
