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
    if (typeof filterMulti === "function" && typeof window.viz !== "undefined") {
      filterMulti();
      return;
    }
    window.location.href = "/app/?food=" + encodeURIComponent(value);
  });
});
