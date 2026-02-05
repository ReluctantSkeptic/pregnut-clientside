// 1 - Global Variable 
var viz,workbook;
var TOP_DASHBOARD_NAME = "TopTenDash";
var FOOD_DASHBOARD_NAME = "FoodCalcDash";
var SHEET_NAME = "FoodFinder";
var FILTER_FIELD = "FoodName";
var pendingFood = null;
var currentDashboardName = null;

function getInitialView(params) {
    if (params && params.get("food")) return FOOD_DASHBOARD_NAME;
    return TOP_DASHBOARD_NAME;
}

// 2. Initialize the Tableau workbook to pull it into the html div container
function initViz() {
    var containerDiv = document.getElementById("vizContainer")
    var params = new URLSearchParams(window.location.search);
    var initialView = getInitialView(params);
    var url = "https://public.tableau.com/views/PregnancyNutritionFinder/" + initialView + "?:showVizHome=no";
    var options = {
                hideTabs: true,
                hideToolbar: true,
                width: "100%",
                height: "100%",
                //"Long Desc": "Catsup",
                onFirstInteractive: function () {
                workbook = viz.getWorkbook();
                                activeSheet = workbook.getActiveSheet();
                                currentDashboardName = activeSheet && activeSheet.getName ? activeSheet.getName() : null;
                                window.currentDashboardName = currentDashboardName;
                var food = pendingFood || params.get('food');
                if (food) {
                  pendingFood = null;
                  filterDash(food);
                  document.getElementById("FoodFinderInput").value = food;
                }
                }
            };
    viz = new tableau.Viz(containerDiv, url, options);
};


// 3. Switch to alternative sheets
function switchView(sheetName) {
    var workbook = viz.getWorkbook();
    workbook.activateSheetAsync(sheetName)
        .then(function (activeSheet) {
            currentDashboardName = activeSheet && activeSheet.getName ? activeSheet.getName() : sheetName;
            window.currentDashboardName = currentDashboardName;
        });
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


// 5.2 Filter a dashboard not sheet
function filterDash(mySelectedFood) {
    if (!mySelectedFood) return;
    if (!workbook) {
        pendingFood = mySelectedFood;
        return;
    }

    var applyFoodFilter = function(sheet) {
        return sheet.applyFilterAsync(FILTER_FIELD, mySelectedFood, "replace");
    };
    var normalizeName = function(name) {
        return String(name || "").toLowerCase().replace(/\s+/g, "");
    };
    var findWorksheet = function(worksheets, targetName) {
        var target = normalizeName(targetName);
        for (var i = 0; i < worksheets.length; i++) {
            var current = normalizeName(worksheets[i].getName());
            if (current === target || current.indexOf(target) !== -1) {
                return worksheets[i];
            }
        }
        return worksheets[0] || null;
    };

    workbook.activateSheetAsync(FOOD_DASHBOARD_NAME)
        .then(function (activeSheet) {
            currentDashboardName = activeSheet && activeSheet.getName ? activeSheet.getName() : FOOD_DASHBOARD_NAME;
            window.currentDashboardName = currentDashboardName;
            if (activeSheet.getSheetType && activeSheet.getSheetType() === tableau.SheetType.DASHBOARD) {
                var finderDash = findWorksheet(activeSheet.getWorksheets(), SHEET_NAME);
                if (finderDash) {
                    return applyFoodFilter(finderDash);
                }
            }

            if (activeSheet.getName && activeSheet.getName() === SHEET_NAME) {
                return applyFoodFilter(activeSheet);
            }

            return workbook.activateSheetAsync(SHEET_NAME)
                .then(function(sheet) {
                    return applyFoodFilter(sheet);
                });
        });
};
