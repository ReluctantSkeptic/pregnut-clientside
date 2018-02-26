// 1 - Global Variable 
var viz,workbook;

// 2. Initialize the Tableau workbook to pull it into the html div container
function initViz() {
    var containerDiv = document.getElementById("vizContainer")
    var url = "https://public.tableau.com/views/PregnancyNutritionFinder/TopTenDash";
    var options = {
                hideTabs: true,
                hideToolbar: true,
                // width: "1200px",
                // height: "900px",
                //"Long Desc": "Catsup",
                onFirstInteractive: function () {
                workbook = viz.getWorkbook();
                activeSheet = workbook.getActiveSheet();
                }
            };
    viz = new tableau.Viz(containerDiv, url, options);
};


// 3. Switch to alternative sheets
function switchView(sheetName) {
    var workbook = viz.getWorkbook();
    workbook.activateSheetAsync(sheetName);
};

//4. Clear all filters
// function clearFilters() {
//     var sheet = viz.getWorkbook().getActiveSheet();
//     alert("clearing sheet:" + workbook.getActiveSheet().getName());
//     activeSheet.clearFilterAsync("FoodName");
// };


// 5. Filter Multi Execute 
function filterMulti() {
    var selectedFood = document.getElementById("FoodFinderInput").value;
    filterDash(selectedFood);
};


// 5.2 Filter a dashboard not sheet  //http://www.datablick.com/blog/tableau-js-api-101
function filterDash(mySelectedFood) {
    var dashboard, finderDash;
    workbook.activateSheetAsync("FoodCalcDash")
        .then(function (sheetName) {
        dashboard = sheetName;
        finderDash = dashboard.getWorksheets().get("FoodFinder");
        return finderDash.applyFilterAsync("FoodName", mySelectedFood , tableau.FilterUpdateType.REPLACE);
    }); 
};