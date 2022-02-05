const POST_URL = "//DISCORD WEBHOOK GOES HERE//"

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
  let preItems = []
  let items = []
  let rio
  let applyAsA
  let characterS
  let serverS

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
        rio = JSON.parse(getRio('us',serverS,characterS,RIO_FIELDS))

        // insert wcl link
        insertItem(items,'Warcraft Logs',getWcl(serverS,characterS))
        //insert rio link
        insertItem(items,'RaiderIO',rio['profile_url'])
        //insert raid prog
        insertItem(items,'Castle Nathria',rio['raid_progression']['castle-nathria']['summary'],true)
        insertItem(items,'Sanctum of Domination',rio['raid_progression']['sanctum-of-domination']['summary'],true)
        // let raidProgS = '**Castle Nathria** | '
        // raidProgS = raidProgS.concat(rio['raid_progression']['castle-nathria']['summary']).concat('\n')
        // raidProgS = raidProgS.concat('**Sanctum of Domination** | ')
        // raidProgS = raidProgS.concat(rio['raid_progression']['sanctum-of-domination']['summary'])
        // insertItem(items,'Raid Progression',raidProgS)
        continue
      } else if (question == discQ) {
        question = 'Discord ID'
      } else if (question == specQ) {
        // insert inlines
        insertItem(preItems,'Applying As',applyAsA,true)
        insertItem(preItems,specQ,answer,true)
        insertItem(preItems,'ilvl',rio['gear']['item_level_equipped'],true)
        // io is an int, concat with empty string to convert
        insertItem(preItems,'IO Score',''.concat(rio['mythic_plus_scores']['all']))
        continue
      }

      if (!answer) {
          continue
      }

      insertItem(items,question,answer)
  }

  let finalItems = joinLists(preItems,items)

  const options = {
      'method': 'post',
      'headers': {
        'Content-Type': 'application/json',
      },
      'payload': JSON.stringify({
          'content': '',
          'embeds': [{
            'title': characterS.concat(' - ').concat(serverS),
            'color': classColors[rio['class']],
            'fields': finalItems,
            'thumbnail': {
                'url': rio['thumbnail_url']
              }
            }]
      })
  }

  UrlFetchApp.fetch(POST_URL, options)
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
  //return fetch(wclUrl) // don't actually want to fetch this..
  return wclUrl
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

function fetch(url) {
  return UrlFetchApp.fetch(url)
}

function fetchOpts(url,opts) {
  return UrlFetchApp.fetch(url,opts)
}