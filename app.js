// 1 - Global Variable 
var viz,workbook;


// 2. Initialize the Tableau workbook to pull it into the html div container
function initViz() {
    var containerDiv = document.getElementById("vizContainer")
    var url = "https://public.tableau.com/views/PregnancyNutritionFinder/TopTenDash";
    var options = {
                hideTabs: true,
                hideToolbar: true,
                //width: "800px",
                //height: "800px",
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
    print();

};



//4. Clear all filters
function clearFilters() {
    var sheet = viz.getWorkbook().getActiveSheet();
    alert("clearing sheet:" + workbook.getActiveSheet().getName());
    activeSheet.clearFilterAsync("FoodName");
};



// Print out your selection in html - for testing
function print() {
    document.getElementById("mySheet").innerHTML =  workbook.getActiveSheet().getName() ;
    document.getElementById("myChoice").innerHTML = document.getElementById("FoodFinderInput").value;
};



//4. Switch to Finder Sheet and do chain call for food - only works on sheet, not dash
function foodFinderChain() {
    var selectedFood = document.getElementById("FoodFinderInput").value
    workbook.activateSheetAsync("FoodFinder")
      .then(function (newSheet) {
        activeSheet = newSheet;
        return activeSheet.applyFilterAsync("FoodName",selectedFood,tableau.FilterUpdateType.REPLACE);
    });
}; 



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






function clearToolbar(){

    document.getElementById("FoodFinderInput").setAttribute("style","height: 1px;");
};

