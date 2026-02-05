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
      var currentName = window.currentDashboardName || null;
      var foodDashName = typeof window.FOOD_DASHBOARD_NAME === "string" ? window.FOOD_DASHBOARD_NAME : null;
      var foodSheetName = typeof window.SHEET_NAME === "string" ? window.SHEET_NAME : null;
      if (currentName && (currentName === foodDashName || currentName === foodSheetName)) {
        filterMulti();
        return;
      }
    }
    window.location.href = "/app/?food=" + encodeURIComponent(value);
  });
});
