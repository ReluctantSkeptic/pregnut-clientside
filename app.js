// 1 - Global Variable 
    var viz , selectedFood;

// 2. Initialize the Tableau workbook to pull it into the html div container
    function initViz() {
        var containerDiv = document.getElementById("vizContainer")
        var url = "https://public.tableau.com/views/PregnancyNutritionFinder/FoodList";
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
        }

// 3. Switch to alternative sheets
function switchView(sheetName) {
    var workbook = viz.getWorkbook();
    workbook.activateSheetAsync(sheetName);
    print();

}

//4. Clear all filters
// function clearFilters() {
//     var sheet = viz.getWorkbook().getActiveSheet();
//     alert("clearing sheet:" + workbook.getActiveSheet().getName());
//     activeSheet.clearFilterAsync("FoodName");
//     } 

//Print out your selection in html
function print() {
    document.getElementById("mySheet").innerHTML =  workbook.getActiveSheet().getName() ;
    document.getElementById("myChoice").innerHTML = document.getElementById("FoodFinderInput").value;
};


//4. Switch to Finder Sheet and do chain call for food
// function foodFinderChain() {
//     var selectedFood = document.getElementById("FoodFinderInput").value
//     workbook.activateSheetAsync("FoodFinder")
//       .then(function (newSheet) {
//         activeSheet = newSheet;
//         return activeSheet.applyFilterAsync("FoodName",selectedFood,tableau.FilterUpdateType.REPLACE);
//         });
//     }; 



// 5. Filter Multi Execute 
function filterMulti() {
    selectedFood = document.getElementById("FoodFinderInput").value;
    print();
    filterDash(selectedFood);
}
    // 5.2 Filter a dashboard not sheet  //http://www.datablick.com/blog/tableau-js-api-101
    function filterDash(mySelectedFood) {
        var dashboard, finderDash;
        workbook.activateSheetAsync("FoodCalcDash")
            .then(function (sheet) {
            dashboard = sheet;
            finderDash = dashboard.getWorksheets().get("FoodFinder");
            return finderDash.applyFilterAsync("FoodName", mySelectedFood , tableau.FilterUpdateType.REPLACE);
        }); 
    };


// Custom lookup - if on finderDash, just look, if on other page, go to finderDash
// function dynamicFoodFind(){
//     var selectedFood = document.getElementById("FoodFinderInput").value
//     if(workbook.getActiveSheet().getName() === 'FoodCalcDash')
//         {
//             sheet=viz.getWorkbook().getActiveSheet();
//             worksheetArray = sheet.getWorksheets();
//             for(var i =0; i < worksheetArray.length; i++){
//                 worksheetArray[i].applyFilterAsync("FoodName",selectedFood,tableau.FilterUpdateType.REPLACE);}
//         }
//     else{
//             var dashboard, finderDash;
//             workbook.activateSheetAsync("FoodCalcDash")
//                 .then(function (sheet) {
//                 dashboard = sheet;
//                 finderDash = dashboard.getWorksheets().get("FoodFinder");
//                 return finderDash.applyFilterAsync("FoodName", selectedFood, tableau.FilterUpdateType.REPLACE);
//             }) 
//         }
//     };


// query which worksheets exist in dash
// function vizFilter(filterValue){
//     sheet=viz.getWorkbook().getActiveSheet();
//     if(sheet.getSheetType() === 'worksheet'){
//         sheet.applyFilterAsync("FoodName",filterValue,tableau.FilterUpdateType.REPLACE);
//     }
//     else{
//         worksheetArray = sheet.getWorksheets();
//         for(var i =0; i < worksheetArray.length; i++){
//             worksheetArray[i].applyFilterAsync("FoodName",filterValue,tableau.FilterUpdateType.REPLACE);
//             }
//         }
//     };

