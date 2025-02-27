//Setup
export default async function({login, q, imports, data, account}, {enabled = false} = {}) {
  //Plugin execution
  try {
    //Check if plugin is enabled and requirements are met
    if ((!enabled) || (!q.starlists))
      return null

    //Load inputs
    let {limit, ignored, only, "limit.repositories":_limit, "shuffle.repositories":_shuffle} = imports.metadata.plugins.starlists.inputs({data, account, q})
    ignored = ignored.map(imports.stripemojis)
    only = only.map(imports.stripemojis)

    //Start puppeteer and navigate to star lists
    console.debug(`metrics/compute/${login}/plugins > starlists > starting browser`)
    const browser = await imports.puppeteer.launch()
    console.debug(`metrics/compute/${login}/plugins > starlists > started ${await browser.version()}`)
    const page = await browser.newPage()

    //Fetch star lists
    console.debug(`metrics/compute/${login}/plugins > starlists > fetching lists`)
    await page.goto(`https://github.com/${login}?tab=stars`)
    let lists = (await page.evaluate(() => [...document.querySelectorAll("[href^='/stars/lowlighter/lists']")].map(element => ({
        link:element.href,
        name:element.querySelector("h3")?.innerText ?? "",
        description:element.querySelector("span")?.innerText ?? "",
        count:Number(element.querySelector("div")?.innerText.match(/(?<count>\d+)/)?.groups.count),
        repositories:[],
      }))
    ))
    const count = lists.length
    console.debug(`metrics/compute/${login}/plugins > starlists > found [${lists.map(({name}) => name)}]`)
    lists = lists
      .filter(({name}) => {
        name = imports.stripemojis(name ?? "").trim().toLocaleLowerCase()
        if (only.length)
          return only.includes(name)
        return !ignored.includes(name)
      })
      .slice(0, limit)
    console.debug(`metrics/compute/${login}/plugins > starlists > extracted ${lists.length} lists`)

    //Fetch star list content
    for (const list of lists) {
      console.debug(`metrics/compute/${login}/plugins > starlists > fetching ${list.name}`)
      await page.goto(list.link)
      const repositories = await page.evaluate(() => [...document.querySelectorAll("#user-list-repositories > div")].map(element => ({
          name:element.querySelector("div:first-child")?.innerText.replace(" / ", "/") ?? "",
          description:element.querySelector(".py-1")?.innerText ?? "",
        }))
      )
      list.repositories.push(...repositories)
      if (_shuffle)
        list.repositories = imports.shuffle(list.repositories)
      list.repositories = list.repositories.slice(0, _limit)
    }

    //Close browser
    console.debug(`metrics/compute/${login}/plugins > starlists > closing browser`)
    await browser.close()

    //Results
    return {lists, count}
  }
  //Handle errors
  catch (error) {
    throw {error:{message:"An error occured", instance:error}}
  }
}
