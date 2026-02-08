// src/js/searchbar.js

$(function () {
  var $input = $("#FoodFinderInput");
  if ($input.length && $.fn.easyAutocomplete) {
    var foodFinderInit = {
      url: "/foodfindersearch.json",
      getValue: "FoodName",
      list: {
        match: { enabled: true },
        maxNumberOfElements: 20
      }
    };
    $input.easyAutocomplete(foodFinderInit);
    $("div.easy-autocomplete").removeAttr("style");
  }

  $("#FoodFinderSearchButton").on("click", function () {
    var value = $input.val();
    if (!value) {
      return;
    }
    window.location.href = "/food/?food=" + encodeURIComponent(value);
  });

  $input.on("keydown", function (ev) {
    if (ev && ev.key === "Enter") {
      ev.preventDefault();
      $("#FoodFinderSearchButton").trigger("click");
    }
  });
});
