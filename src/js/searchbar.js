// src/js/searchbar.js

// Run Search Bar
const foodFinderInit = {
  url: "/foodfindersearch.json",
  getValue: "FoodName",
  list: {
    match: { enabled: true },
    maxNumberOfElements: 20
  }
};
$("#FoodFinderInput").easyAutocomplete(foodFinderInit);
$('div.easy-autocomplete').removeAttr('style');

// Nav‐item active class toggle
$(function(){
  $('nav-item').on('click', function(){
    $('nav-item').removeClass('active');
    $(this).addClass('active');
  });
});
