const POST_URL = '//DISCORD WEBHOOK GOES HERE//'

// https://articles.warcraftlogs.com/help/api-documentation
//const WCL_ID = '//WARCRAFTLOGS CLIENT ID GOES HERE//'
//const WCL_SECRET = '//WARCRAFTLOGS SECRET KEY GOES HERE//'
// token is base64-encoded client ID + client secret..
const WCL_TOKEN_BASE64 = '//WARCRAFTLOGS BASE64 TOKEN GOES HERE//'
const WCL_TOKEN_URI = 'https://www.warcraftlogs.com/oauth/token'
const WCL_CLIENT_CREDS_OPTS = {
  'method': 'post',
  'headers': {'Authorization': 'Basic '.concat(WCL_TOKEN_BASE64)},
  'payload': 'grant_type=client_credentials'
}
let wclClientToken
const WCL_OVERALL_QUERY = 'query($name:String!,$server:String!,$region:String!) {\
  characterData {\
    character(name:$name,serverSlug:$server,serverRegion:$region) {\
      zoneRankings\
    }\
}}'
const WCL_BRACKET_QUERY = 'query($name:String!,$server:String!,$region:String!) {\
  characterData {\
    character(name:$name,serverSlug:$server,serverRegion:$region) {\
      zoneRankings(byBracket:true)\
    }\
}}'

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
  const response = e.response.getItemResponses()
  let embeds = []
  let basicItems = []
  let raidProgItems = []
  let parseItems = []
  let linkItems = []
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
          basicItems = []
          raidProgItems = []
          parseItems = []
          linkItems = []
          insertItem(basicItems,'!!Error!!','Applicant mispelled character name..')
        }

        if (!rio) continue // short-circuit

        // insert wcl link
        insertItem(linkItems,'Warcraft Logs',getWcl(serverS,characterS))
        //insert rio link
        insertItem(linkItems,'RaiderIO',rio['profile_url'])
        //insert raid prog
        for (const raidProg of Object.entries(rio['raid_progression'])) {
          let raidName = raidProg[0].split('-')
                                    .map(raid => raid[0].toUpperCase()
                                                        .concat(raid.slice(1))
                                    ).join(' ')
          let prog = raidProg[1]['summary']
          insertItem(raidProgItems,raidName,prog,true)
        }
        continue
      } else if (question == discQ) {
        question = 'Discord ID'
      } else if (question == specQ) {
        if (!rio) continue // short-circuit
        // insert inlines
        insertItem(basicItems,'Applying As',applyAsA,true)
        insertItem(basicItems,specQ,answer,true)
        insertItem(basicItems,'ilvl',rio['gear']['item_level_equipped'],true)
        // io is an int, concat with empty string to convert
        insertItem(parseItems,'IO Score',''.concat(rio['mythic_plus_scores']['all']),false)
        // insert parses
        let overallRankings = getWclRankings(WCL_OVERALL_QUERY,characterS,serverS)
        let bracketRankings = getWclRankings(WCL_BRACKET_QUERY,characterS,serverS)
        insertItem(parseItems,'Best By ilvl',
                    roundDecimalAsString(bracketRankings['bestPerformanceAverage']),true)
        insertItem(parseItems,'Median By ilvl',
                    roundDecimalAsString(bracketRankings['medianPerformanceAverage']),true)
        insertItem(parseItems,'Best Overall',
                  roundDecimalAsString(overallRankings['bestPerformanceAverage']),true)
        insertItem(parseItems,'Median Overall',
                  roundDecimalAsString(overallRankings['medianPerformanceAverage']),true)
        continue
      }

      if (!answer) {
          continue
      }

      insertItem(basicItems,question,answer)
  }

  let classColor = 16711680
  let thumbnail = 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'
  if (rio) {
    classColor = classColors[rio['class']]
    thumbnail = rio['thumbnail_url']
  }

  // insert basic embed
  insertEmbed(embeds,basicItems,classColor,characterS.concat(' - ').concat(serverS),thumbnail)
  // insert raidProg embed
  if (raidProgItems.length > 0) insertEmbed(embeds,raidProgItems,classColor,'Raid Progression')
  // insert parse embed
  if (parseItems.length > 0) insertEmbed(embeds,parseItems,classColor,'Stats')
  // insert link embed
  if (linkItems.length > 0) insertEmbed(embeds,linkItems,classColor)
  
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

function insertItem(items,name,value,inline) {
  items.push({
    'name': '__'.concat(name).concat('__'),
    'value': value,
    'inline': inline
  })
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

function getWclRankings(query,name,server) {
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
        'region': 'us'
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