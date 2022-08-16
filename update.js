require('dotenv').config()
https = require('https');

//they are on the same server
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  })

const axios = require('axios');
axios.defaults.httpsAgent = httpsAgent
let data = []
var languageList = ["english","german"]
let gameLanguages = []
let gameGenres = []
let gameCategories = []
async function updateAppList() {
    const getDataFromSteamApi = await axios.get('http://api.steampowered.com/ISteamApps/GetAppList/v0002/?format=json');
    const getAppListFromServer = await axios.get(`${process.env.APISERVERADDRESS}/api/appList/`,);

    data = getDataFromSteamApi.data.applist.apps;
    console.log("----- Updating app list")
    for(var i = 0; i < data.length; i++) {
        duplicate = false
        var postdata = JSON.stringify({
            "appid": data[i].appid,
            "name": data[i].name,
            "dead_entry": false,
            "update_scheduled": true,
            "not_a_game": false
        });
        if(i%10==0){
            console.log("--- Submiting: data: " + i + "/" + data.length)
        }
        const submitDataToDatabaseApi = await axios.post(`${process.env.APISERVERADDRESS}/api/appList/`, postdata, {
            headers: {
              'Content-Type': 'application/json'
            }
          })
          .catch(error => {
              if(error.response.status == 500){
                  duplicate = true
                  if(error.response.data.message != `Duplicate entry '${data[i].appid}' for key 'appList.PRIMARY'`){
                  console.log(error)
                  }
              }
          })
          if(duplicate){
              //console.log("Update existing record")
              const getAppFromServer = await axios.get(`${process.env.APISERVERADDRESS}/api/appList/${data[i].appid}`);
              var updatepostdata = JSON.stringify({
                "appid": data[i].appid,
                "name": data[i].name,
                "dead_entry": false,
                "update_scheduled": getAppFromServer.data.update_scheduled,
                "not_a_game": getAppFromServer.data.not_a_game
            });
            const updateExistingData = await axios.put(`${process.env.APISERVERADDRESS}/api/appList/` + data[i].appid, updatepostdata,{
                        headers: {
                        'Content-Type': 'application/json'
                        }
                    })
                    .catch(error => {
                        console.log(error)
                })
        }
    }

    console.log("Finished")
}

async function updateDetailList(){
    const getAppListFromServer = await axios.get(`${process.env.APISERVERADDRESS}/api/appList/`);
    numberOfData = getAppListFromServer.data.length
    console.log(`${process.env.APISERVERADDRESS}/api/appList/`)
    console.log("----- Updating detail list")
    totalErrorsMitigated = 0
    for(var i = 0; i < numberOfData; i++){
        console.log("---- Fetching data: " + (i+1) + "/" + numberOfData)
        id = getAppListFromServer.data[i].appid
        appName = getAppListFromServer.data[i].name
        isUpdateNeeded = getAppListFromServer.data[i].update_scheduled
        isDeadEntry = getAppListFromServer.data[i].dead_entry
        isNotAGame = getAppListFromServer.data[i].not_a_game
        if(i % 100 == 0){
            console.log("Total errors mitigated: " + totalErrorsMitigated)
        }
        if(!isDeadEntry && !isNotAGame && isUpdateNeeded){
            for(var l = 0; l < languageList.length; l++){
                //If dead entry founded no need to try update another languages
                try{
                    deadEntryFound = await tryCreateOrUpdateEntry(id, appName, languageList[l])
                    if(deadEntryFound){
                        await delay(1510)
                        break;
                    }
                    await delay(1510)
                }
                catch(error){
                    totalErrorsMitigated++
                    l = -1
                    console.log(error + `|Error, retrying after few seconds, id:${id}, total errors: ` + totalErrorsMitigated)
                    await delay(5000)
                }
            }
        }
        else{
            console.log("Update not needed/Dead entry/Not a game: "+id)
        }
    }
}

async function updateFeaturedGames(){
    const cleareFeaturedGames = await axios.delete(`${process.env.APISERVERADDRESS}/api/featured/`);
    const getFeaturedFromSteamApi = await axios.get('https://store.steampowered.com/api/featured/');
    var featuredData = getFeaturedFromSteamApi.data.featured_win;
    //console.log(featuredData)
    for(var i = 0; i < featuredData.length; i++){
        var postdata = JSON.stringify({
            "id": featuredData[i].id
        });
        const pushFeaturedId = await axios.post(`${process.env.APISERVERADDRESS}/api/featured/`, postdata, {
            headers: {
              'Content-Type': 'application/json'
            }
          })
    }
}

async function startUpdate(){
    await updateAppList()
    await updateDetailList()
}

function convertArrayToString(array){
    converted = ""
    for(var i = 0; i < array.length - 1; i++){
        converted+= array[i]+","
    }
    converted += array[array.length - 1]
    return converted
}

async function initCacheLists(){
    gameLanguages = (await axios.get(`${process.env.APISERVERADDRESS}/api/languageList/`)).data;
    gameGenres = (await axios.get(`${process.env.APISERVERADDRESS}/api/genreList/`)).data;
    gameCategories = (await axios.get(`${process.env.APISERVERADDRESS}/api/categoryList/`)).data;
}

async function addValueToDatabase(language, objectValue, database){
    var exists = false
    if(database == "language"){
        for(var i = 0; i < gameLanguages.length; i++){
            if(gameLanguages[i].language == language && gameLanguages[i].value == objectValue){
                exists = true
            }
        }
      }
      else if(database == "genre"){
        for(var i = 0; i < gameGenres.length; i++){
            if(gameGenres[i].language == language && gameGenres[i].value == objectValue){
                exists = true
            }
        }
      }
      else if(database == "category"){
        for(var i = 0; i < gameCategories.length; i++){
            if(gameCategories[i].language == language && gameCategories[i].value == objectValue){
                exists = true
            }
        }
      }
    if(!exists){
        objectToPush = {
            "language": language,
            "value": objectValue
        }
        var postdata = JSON.stringify(objectToPush);
        const submitDataToDatabaseApi = await axios.post(`${process.env.APISERVERADDRESS}/api/${database}List/`, postdata, {
            headers: {
              'Content-Type': 'application/json'
            }
          })
          if(database == "language"){
            gameLanguages.push(objectToPush)
          }
          else if(database == "genre"){
            gameGenres.push(objectToPush)
          }
          else if(database == "category"){
            gameCategories.push(objectToPush)
          }
    }
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }

async function tryCreateOrUpdateEntry(appid, name, language){
    console.log(`Checking ${language} version`)
    const getDataFromSteamApi = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${id}&l=${language}`);
    fetchData = getDataFromSteamApi.data[appid]
    //Sometimes fetch data is undefined!
    if(fetchData == undefined){
        console.log("Empty record, skipping...")
    }
    else{
        if(fetchData.success){
            data = fetchData.data
            apptype = data.type
            duplicate = false
            if(apptype == "game"){
                //console.log(data)
                languageText = ""
                if(data.supported_languages != undefined){
                    languageText = data.supported_languages.replaceAll("<strong>*</strong>", "")
                    languageText = languageText.replaceAll("<br>", "")
                    languageText = languageText.replaceAll("\r\n", ",")
                    languageText = languageText.replace("languages with full audio support", "")
                    languageText = languageText.replace("Sprachen mit voller Audiounterstützung", "")
                    var split = languageText.split(",")
                    for (var y = 0; y < split.length; y++) {
                        if(split[y][0] == " "){
                            split[y] = split[y].replace(" ", "")
                        }
                        await addValueToDatabase(language, split[y], "language")
                    }
                }
                else{
                    languageText = null
                }
                categoriesText = ""
                if(data.categories != undefined){
                    for(var y = 0; y < data.categories.length - 1; y++){
                        categoriesText += data.categories[y].description + ","
                        await addValueToDatabase(language, data.categories[y].description, "category")
                    }
                    categoriesText += data.categories[data.categories.length - 1].description
                    await addValueToDatabase(language, data.categories[data.categories.length - 1].description, "category")
                }
                else{
                    categoriesText = null
                }
                genresText = ""
                if(data.genres != undefined){
                    for(var y = 0; y < data.genres.length - 1; y++){
                        genresText += data.genres[y].description + ","
                        await addValueToDatabase(language, data.genres[y].description, "genre")
                    }
                    genresText += data.genres[data.genres.length - 1].description
                    await addValueToDatabase(language, data.genres[data.genres.length - 1].description, "genre")
                }
                else{
                    genresText = null
                }
                screenshots_thumbnailText = ""
                screenshots_fullText = ""
                if(data.screenshots != undefined){
                    for(var y = 0; y < data.screenshots.length - 1; y++){
                        screenshots_thumbnailText += data.screenshots[y].path_thumbnail + ","
                        screenshots_fullText += data.screenshots[y].path_full + ","
                    }
                    screenshots_thumbnailText += data.screenshots[data.screenshots.length - 1].path_thumbnail
                    screenshots_fullText += data.screenshots[data.screenshots.length - 1].path_full
                }
                else{
                    screenshots_thumbnailText = null
                    screenshots_fullText = null
                }
                
                var postdata = JSON.stringify({
                    "steam_appid": data.steam_appid,
                    "name": data.name == undefined ? null : data.name,
                    "required_age": data.required_age == undefined ? null : data.required_age,
                    "is_free": data.is_free == undefined ? null : data.is_free,
                    "detailed_description": data.detailed_description == undefined ? null : data.detailed_description,
                    "about_the_game": data.about_the_game == undefined ? null : data.about_the_game,
                    "short_description": data.short_description == undefined ? null : data.short_description,
                    "supported_languages": languageText,
                    "reviews": data.reviews == undefined ? null : data.reviews,
                    "header_image": data.header_image == undefined ? null : data.header_image,
                    "website": data.website == undefined ? null : data.website,
                    "developers": data.developers == undefined ? null : convertArrayToString(data.developers),
                    "publishers": data.publishers == undefined ? null :convertArrayToString(data.publishers),
                    "windows": data.platforms == undefined ? null : data.platforms.windows,
                    "mac": data.platforms == undefined ? null : data.platforms.mac,
                    "linux": data.platforms == undefined ? null : data.platforms.linux,
                    "metacritic_score": data.metacritic == undefined ? null : data.metacritic.score,
                    "metacritic_url": data.metacritic == undefined ? null : data.metacritic.url,
                    "categories": categoriesText,
                    "genres": genresText,
                    "screenshots_thumbnail": screenshots_thumbnailText,
                    "screenshots_full": screenshots_fullText,
                    "recommendations": data.recommendations == undefined ? null : data.recommendations.total,
                    "coming_soon": data.release_date == undefined ? null : data.release_date.coming_soon,
                    "date": data.release_date == undefined ? null : data.release_date.date,
                    "pc_requirements_min": data.pc_requirements == undefined ? null : data.pc_requirements.minimum == undefined ? null : data.pc_requirements.minimum,
                    "pc_requirements_recommended": data.pc_requirements == undefined ? null : data.pc_requirements.recommended == undefined ? null : data.pc_requirements.recommended
                });
                console.log("Submitting: data: "+data.steam_appid)
                const submitDataToDatabaseApi = await axios.post(`${process.env.APISERVERADDRESS}/api/detailList/?l=${language}`, postdata, {
                    headers: {
                    'Content-Type': 'application/json'
                    }
                })
                .catch(error => {
                    if(error.response.status == 500){
                        duplicate = true
                    }
                })
                if(duplicate){
                    console.log("Update existing record")
                    const updateExistingData = await axios.put(`${process.env.APISERVERADDRESS}/api/detailList/` + data.steam_appid + `?l=${language}`, postdata,{
                                headers: {
                                'Content-Type': 'application/json'
                                }
                            })
                            .catch(error => {
                                console.log(error)
                        })
                }
                var postdata = JSON.stringify({
                    "appid": appid,
                    "name": name,
                    "dead_entry": false,
                    "update_scheduled": false,
                    "not_a_game": false
                });
                const updateDeadEntry = await axios.put(`${process.env.APISERVERADDRESS}/api/appList/` + appid, postdata,{
                        headers: {
                        'Content-Type': 'application/json'
                        }
                    })
                    .catch(error => {
                        console.log(error)
                })
            return false
            }
            else{
                console.log("Not a game: "+appid)
                var postdata = JSON.stringify({
                    "appid": appid,
                    "name": name,
                    "dead_entry": false,
                    "update_scheduled": false,
                    "not_a_game": true
                });
                const updateDeadEntry = await axios.put(`${process.env.APISERVERADDRESS}/api/appList/` + appid, postdata,{
                        headers: {
                        'Content-Type': 'application/json'
                        }
                    })
                    .catch(error => {
                        console.log(error)
                })
                return true
            }
        }
        else{
            console.log("Dead entry: "+appid)
            var postdata = JSON.stringify({
                "appid": appid,
                "name": name,
                "dead_entry": true,
                "update_scheduled": false,
                "not_a_game": true
            });
            const updateDeadEntry = await axios.put(`${process.env.APISERVERADDRESS}/api/appList/` + appid, postdata,{
                    headers: {
                    'Content-Type': 'application/json'
                    }
                })
                .catch(error => {
                    console.log(error)
            })
            return true
        }
    }
}

initCacheLists()
startUpdate()
updateFeaturedGames()
