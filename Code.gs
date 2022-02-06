const POST_URL = "//DISCORD WEBHOOK URL//"
 
// https://articles.warcraftlogs.com/help/api-documentation
//const WCL_ID = '//WCL CLIENT KEY'
//const WCL_SECRET = '//WCL SECRET KEY//'
// token is base64-encoded client ID + client secret..
const WCL_TOKEN_BASE64 = '//TOKEN HERE//'
const WCL_TOKEN_URI = 'https://www.warcraftlogs.com/oauth/token'
const WCL_CLIENT_CREDS_OPTS = {
  'method': 'post',
  'headers': {'Authorization': 'Basic '.concat(WCL_TOKEN_BASE64)},
  'payload': 'grant_type=client_credentials'
}
let wclClientToken
const WCL_OVERALL_QUERY = '\
query($name:String!,$server:String!,$region:String!,$metric:CharacterRankingMetricType!) {\
  characterData {\
    character(name:$name,serverSlug:$server,serverRegion:$region) {\
      zoneRankings(metric:$metric)\
    }\
  }\
}'
// not used, saving for a rainy day
// const WCL_BRACKET_QUERY = 'query($name:String!,$server:String!,$region:String!) {\
//   characterData {\
//     character(name:$name,serverSlug:$server,serverRegion:$region) {\
//       zoneRankings(byBracket:true)\
//     }\
// }}'
 
const applyAsQ = 'I\'m applying as:'
const specQ = 'Main Spec'
const charNameQ = 'Character Name (logs, raider.io & guild history will automatically be pulled)'
const serverNameQ = 'Server'
const discQ = 'Discord ID (NOT Bnet) capitalization sensitive! Please accept the discord friend request we send you'
 
// Source: https://wowpedia.fandom.com/wiki/Class_colors
// Converter: https://www.rapidtables.com/convert/number/hex-to-decimal.html
const classColors = {
  'Death Knight': 12852794,
  'Demon Hunter': 10694857,
  'Druid': 16743434,
  'Hunter': 11195250,
  'Mage': 4179947,
  'Monk': 65432,
  'Paladin': 16026810,
  'Priest': 16777215,
  'Rogue': 16774248,
  'Shaman': 28893,
  'Warlock': 8882414,
  'Warrior': 13015917
}
 
const RIO_FIELDS = [
  'gear',
  'mythic_plus_scores',
  'raid_progression'
]
 
function onSubmit(e) {
  let embeds = []
  const response = e.response.getItemResponses()
  let items = []
  let infoItems = []
  let rio
  let applyAsA
  let characterS
  let serverS
 
  wclClientToken = getWclToken()
 
  for (const responseAnswer of response) {
      let question = responseAnswer.getItem().getTitle()
      let answer = responseAnswer.getResponse()
 
      if (question == applyAsQ) {
        applyAsA = answer
        continue
      } else if (question == charNameQ) {
        characterS = answer
        continue
      } else if (question == serverNameQ) {
        serverS = answer
        // only supporting us region for now?
        try {
          rio = JSON.parse(getRio('us',serverS,characterS,RIO_FIELDS))
        } catch {
          items = []
          insertItem(infoItems,'!!Error!!','Applicant mispelled character name..')
        }
        continue
      } else if (question == discQ) {
        question = 'Discord ID'
      } else if (question == specQ) {
        // insert info
        insertItem(infoItems,'Applying As',applyAsA,true)
        insertItem(infoItems,specQ,answer,true)
        //insert raider io
        if (rio) insertItem(infoItems,'ilvl',rio['gear']['item_level_equipped'],true)
        continue
      }
 
      if (!answer) {
          continue
      }
 
      insertItem(infoItems,question,answer)
  }
 
  let classColor = 16711680 // #FF0000 (red)
  let thumbnail = 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'
  if (rio) {
    //insert raid prog
    for (const raidProg of Object.entries(rio['raid_progression'])) {
      let totalBosses = raidProg[1]['total_bosses']
      let hKilled = raidProg[1]['heroic_bosses_killed']
      let mKilled = raidProg[1]['mythic_bosses_killed']
      let raidName = raidProg[0].split('-')
                                .map(raid => raid[0].toUpperCase()
                                                    .concat(raid.slice(1))
                                ).join(' ')
      let prog = ''.concat(mKilled).concat('/').concat(totalBosses).concat('M | ')
      prog = prog.concat(hKilled).concat('/').concat(totalBosses).concat('H')
      insertItem(items,raidName,prog,true)
    }
    
    // insert parses
    let overallRankings = getWclRankings(WCL_OVERALL_QUERY,characterS,serverS)['bestPerformanceAverage']
    if (overallRankings) {
      overallRankings = roundDecimalAsString(overallRankings)
    } else {
      overallRankings = 'N/A'
    }
    let overallParse = linkifyString(overallRankings, getWcl(serverS,characterS))
    insertItem(items,'Avg Parse',overallParse,true)
    // io is an int, concat with empty string to convert
    let ioLink = linkifyString(
      ''.concat(rio['mythic_plus_scores']['all']),
      rio['profile_url']
    )
    insertItem(items,'IO Score',ioLink,true)
 
     // insert wcl and raider io link
    // insertItem(items,'Warcraft Logs',getWcl(serverS,characterS))
    // insertItem(items,'RaiderIO',rio['profile_url'])
 
    classColor = classColors[rio['class']]
    thumbnail = rio['thumbnail_url']
  }
 
  let finalItems = [].concat(infoItems).concat(items)
 
  // insert basic embed
  insertEmbed(embeds,finalItems,classColor,characterS.concat(' - ').concat(serverS),thumbnail)
  
  const options = {
      'method': 'post',
      'headers': {
        'Content-Type': 'application/json',
      },
      'payload': JSON.stringify({
          'content': '',
          'embeds': embeds
      })
  }
 
  // post to disc
  fetch(POST_URL,options)
}
 
function insertItem(items,name,value,inline) {
  items.push({
    'name': '__'.concat(name).concat('__'),
    'value': value,
    'inline': inline
  })
}
 
function insertItemLineBreak(items) {
  items.push({
    'name': '\u200b',
    'value': '\u200b'
  })
}
 
function insertEmbed(embeds,fields,color,title,thumbnail) {
  let embed = {
    'fields':fields,
    'color':color
  }
  
  if (title) {
    embed['title'] = title
  }
  if (thumbnail) {
    embed['thumbnail'] = {
      'url': thumbnail
    }
  }
 
  embeds.push(embed)
}
 
function joinLists(one,two) {
  for (let item of two) {
    one.push(item)
  }
 
  return one
}
 
function roundDecimalAsString(decimal) {
  let num = ''.concat(decimal).split('.')
  return num[0].concat('.').concat(num[1].slice(0,2))
}
 
function strListToString(arr) {
  let r = ''
  for (const i of arr) {
    r = r.concat(i)
  }
  return r
}
 
function linkifyString(text,link) {
  return '['.concat(text).concat('](').concat(link).concat(')')
}
 
// `fields` should be array of strings
// https://raider.io/api#/
const FIELDS_S = '&fields='
function getRio(region,realm,name,fields) {
  let rioUrl = 'https://raider.io/api/v1/characters/profile?region='
  rioUrl = rioUrl.concat(region).concat('&realm=')
  rioUrl = rioUrl.concat(realm).concat('&name=')
  rioUrl = rioUrl.concat(name)
 
  if (fields) {
    rioUrl = rioUrl.concat(FIELDS_S).concat(commaSepLst(fields))
  }
 
  return fetch(rioUrl)
}
 
function getWcl(realm,name) {
  let wclUrl = 'https://www.warcraftlogs.com/character/us/'
  wclUrl = wclUrl.concat(realm).concat('/')
  wclUrl = wclUrl.concat(name)
  return wclUrl
}
 
function getWclToken() {
  return JSON.parse(fetch(WCL_TOKEN_URI,WCL_CLIENT_CREDS_OPTS))['access_token']
}
 
function getWclRankings(query,name,server,metric) {
  if (!metric) metric = 'dps'
  const WCL_OPTS = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer '.concat(wclClientToken)
    },
    'payload': JSON.stringify({
      'query': query,
      'variables': {
        'name': name,
        'server': server,
        'region': 'us',
        'metric': metric
      }
    })
  }
 
  return JSON.parse(fetch('https://www.warcraftlogs.com/api/v2/client',WCL_OPTS))['data']['characterData']['character']['zoneRankings']
}
 
function commaSepLst(arr) {
  let r = ''
  for (const [index,item] of Object.entries(arr)) {
    if (index == 0) {
      r = r.concat(item)
    } else {
      r = r.concat(',').concat(item)
    }
  }
 
  return r
}
 
function fetch(url,opts) {
  if (opts) return UrlFetchApp.fetch(url,opts)
  return UrlFetchApp.fetch(url)
}