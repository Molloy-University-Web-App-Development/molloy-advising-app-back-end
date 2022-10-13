const HTMLParser = require('node-html-parser');
const axios = require('axios');
const fs = require("fs");

function getBrowserRefreshKey(parseTree) {
  return parseTree.getElementById("___BrowserRefresh").getAttribute("value")
}

async function getUser() {
  try {
    const response = await axios.get('https://lionsden.molloy.edu/ICS/Course_Search/Course_Search.jnz?portlet=Course_Schedules&screen=Advanced+Course+Search&screenType=next');
    const ASP = response.headers["set-cookie"].find(element => element.startsWith("ASP.NET_SessionId"))
    const sessionCookie = /=([^;]*);/.exec(ASP)[1]

    const parseTree = HTMLParser.parse(response.data)
    const browserRefreshKey = getBrowserRefreshKey(parseTree);

    return { sessionCookie, browserRefreshKey };
  }
  catch (error) {
    console.error(error);
  }
}
getUser().then((result) => console.log(result));

async function getCourseData() {
  let { sessionCookie, browserRefreshKey } = await getUser();
  const semester = "2022;FA";
  const allResults = [];
  let page = 0;
  const max_Requests = 1024; // to cap the request if failed a lot of times

  for (let i = 0; i < max_Requests; i++) {
    const bodyRequestData = `------FormBoundary\nContent-Disposition: form-data; name="__EVENTTARGET"\n\npg0$V$ltrNav\n------FormBoundary\nContent-Disposition: form-data; name="__EVENTARGUMENT"\n\n${page}\n------FormBoundary\nContent-Disposition: form-data; name="___BrowserRefresh"\n\n${browserRefreshKey}\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$ddlTerm"\n\n${semester}\n${page==0?`------FormBoundary\nContent-Disposition: form-data; name="pg0$V$ddlDept"\n\n\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$ddlCourseFrom"\n\n\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$ddlCourseTo"\n\n\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$ddlTitleRestrictor"\n\nBeginsWith\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$txtTitleRestrictor"\n\n\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$ddlCourseRestrictor"\n\nBeginsWith\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$txtCourseRestrictor"\n\n\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$ddlDivision"\n\n\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$ddlMethod"\n\n\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$ddlTimeFrom"\n\n\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$ddlTimeTo"\n\n\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$days"\n\nrdAnyDay\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$ddlFaculty"\n\n\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$ddlCampus"\n\n\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$ddlBuilding"\n\n\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$ddlSecStatus"\n\nOpenFull\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$txtMin"\n\n\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$txtMax"\n\n\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$hiddenCache"\n\nfalse\n------FormBoundary\nContent-Disposition: form-data; name="pg0$V$btnSearch"\n\nSearch\n------FormBoundary--`:""}`;

    const res = await axios({ method: "POST", url: "https://lionsden.molloy.edu/ICS/Course_Search/Course_Search.jnz?portlet=Course_Schedules&screen=Advanced+Course+Search&screenType=next", data: bodyRequestData, headers: { "content-type": "multipart/form-data; boundary=----FormBoundary", cookie: `ASP.NET_SessionId=${sessionCookie}` } })

    const parseBody = HTMLParser.parse(res.data);

    browserRefreshKey = getBrowserRefreshKey(parseBody);
    console.log(page, browserRefreshKey);

    const table = parseBody.getElementById("pg0_V_dgCourses")

    if (table) {
      const headerTitles = table.querySelectorAll('th').map(x => x.text.toLowerCase().replace(/\s/, "_"))
      const courseDataRows = table.querySelectorAll('tr').map(x => x.querySelectorAll('td').map(x => x.text.trim()))

      const pageResults = courseDataRows?.map(x => x.reduce((acc, courseDataRows, index) => ({ ...acc, [headerTitles[index]]: courseDataRows }), {})).filter(obj => obj.course_code)


      page += 1

      allResults.push(...pageResults)

      if (!parseBody.querySelector(".letterNavigator").text.includes("Next page")) { break }


    }


  }
  return allResults
}

getCourseData().then((result) => fs.writeFileSync("course-data.json", JSON.stringify(result)));



