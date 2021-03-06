require('dotenv').config()
const axios = require('axios');
const { type } = require('os');
let data = []
var languageList = ["english","german"]
async function updateAppList() {
    const getDataFromSteamApi = await axios.get('http://api.steampowered.com/ISteamApps/GetAppList/v0002/?format=json');
    const getAppListFromServer = await axios.get(`${process.env.APISERVERADDRESS}/api/appList/`);

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

async function startUpdate(){
    //await updateAppList()
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

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }

async function tryCreateOrUpdateEntry(appid, name, language){
    console.log(`Checking ${language} version`)
    const getDataFromSteamApi = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${id}&l=${language}`);
    fetchData = getDataFromSteamApi.data[appid]
    //TODO: Sometimes success is undefined!
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
                categoriesText = ""
                if(data.categories != undefined){
                    for(var y = 0; y < data.categories.length - 1; y++){
                        categoriesText += data.categories[y].description + ","
                    }
                    categoriesText += data.categories[data.categories.length - 1].description
                }
                else{
                    categoriesText = null
                }
                genresText = ""
                if(data.genres != undefined){
                    for(var y = 0; y < data.genres.length - 1; y++){
                        genresText += data.genres[y].description + ","
                    }
                    genresText += data.genres[data.genres.length - 1].description
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
                    "supported_languages": data.supported_languages == undefined ? null : data.supported_languages,
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

startUpdate()
