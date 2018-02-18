// 1 - Global Variable 
    var viz;

// 2. Initialize the Tableau workbook to pull it into the html div container
    function initViz() {
        var containerDiv = document.getElementById("vizContainer")
        var url = "https://public.tableau.com/views/PregnancyNutritionFinder/FoodCalcDash";
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

//4. Switch to Finder and do chain call for food
function foodFinderChain() {
    var selectedFood = document.getElementById("FoodFinderInput").value

    workbook.activateSheetAsync("FoodFinder")
      .then(function (newSheet) {
        activeSheet = newSheet;
        return activeSheet.applyFilterAsync("FoodName",selectedFood,tableau.FilterUpdateType.REPLACE);
        });
    }; 

//4. Clear all filters
    function clearFilters() {
        var sheet = viz.getWorkbook().getActiveSheet();
        alert("clearing sheet:" + workbook.getActiveSheet().getName());
        activeSheet.clearFilterAsync("FoodName");
        } 

//Print out your selection in html
    function print() {
        document.getElementById("mySheet").innerHTML =  workbook.getActiveSheet().getName() ;
        document.getElementById("myChoice").innerHTML = document.getElementById("FoodFinderInput").value;
       
        //document.getElementById("myChoice").innerHTML = document.getElementById("selectFood").value;
    };
