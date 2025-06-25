import express from "express";
import got from "got";
import sass from "sass";
import fs from "fs";

const app = express();
const port = 3000;
const hostname = "127.0.0.1";

const css = sass.compile("sass/weather.scss");
fs.writeFileSync("public/css/weather.css", css.css);

app.set("view engine", "ejs");
app.use("/public", express.static("public"));

const key = "e150281fddd691be5f8c3d3c33725f68";
const geo = await got(`https://api.openweathermap.org/geo/1.0/zip?zip=65802,US&appid=${key}`).json();
const getCurrent = () => got(`https://api.openweathermap.org/data/2.5/weather?lat=${geo.lat}&lon=${geo.lon}&units=imperial&appid=${key}`).json();
const getForecast = () => got(`https://api.openweathermap.org/data/2.5/forecast?lat=${geo.lat}&lon=${geo.lon}&units=imperial&appid=${key}`).json();
let current = await getCurrent();
let forecast = await getForecast();

setInterval(async () => {
    current = await getCurrent();
    forecast = await getForecast();
}, 1 * 60 * 1000);

// import Geonames from "geonames.js";
// const geonames = Geonames({username: 'myusername', lan: 'en', encoding: 'JSON'});
// geonames.search({
//     q: "Springfield",
//     cities: "cities5000",
// }).then(r => {
//     console.log(r)
// });

function getRelativeLinkFromQueryParams(q, path) {
    let q_str = new URLSearchParams(q).toString();
    return q_str === "" ? path : path + "?" + q_str;
}

function getDetails(current, forecast, q) {
    if (q.hour) {
        return getHourDetails(forecast, q);
    } else if (q.day) {
        return getDayDetails(forecast, q);
    } else {
        return getDefaultDetails(current);
    }
}

function getDefaultDetails(current) {
    return {
        icon: current.weather[0].icon,
        icon_alt: current.weather[0].description,
        temp: Math.round(current.main.temp),
        date: new Date(current.dt * 1000).toLocaleDateString("en-us", {weekday: "short", month: "short", day: "numeric"}),
        time: new Date(current.dt * 1000).toLocaleTimeString("en-us", {hour: "numeric", minute: "numeric"}),
        weather: current.weather[0].main,
        feels_like: Math.round(current.main.feels_like),
        humidity: current.main.humidity,
        wind: Math.round(current.wind.speed),
    }
}

function getHourDetails(forecast, q) {
    let hour = forecast.list[parseInt(q.hour || 0) + parseInt(q.day || 0) * 8];
    return {
        icon: hour.weather[0].icon,
        icon_alt: hour.weather[0].description,
        temp: Math.round(hour.main.temp),
        date: new Date(hour.dt * 1000).toLocaleDateString("en-us", {weekday: "short", month: "short", day: "numeric"}),
        time: new Date(hour.dt * 1000).toLocaleTimeString("en-us", {hour: "numeric"}),
        weather: hour.weather[0].main,
        feels_like: Math.round(hour.main.feels_like),
        humidity: hour.main.humidity,
        wind: Math.round(hour.wind.speed),
    }
}

function getDayDetails(forecast, q) {
    let day = parseInt(q.day || 0);

    let temp_sum = 0;
    let feels_like_sum = 0;
    let humidity_sum = 0;
    let wind_sum = 0;

    for (let i = 0; i < 8; i++) {
        let hour = forecast.list[day * 8 + i];
        temp_sum += hour.main.temp;
        feels_like_sum += hour.main.feels_like;
        humidity_sum += hour.main.humidity;
        wind_sum += hour.wind.speed;
    }

    return {
        icon: forecast.list[day * 8].weather[0].icon,
        icon_alt: forecast.list[day * 8].weather[0].description,
        temp: Math.round(temp_sum / 8),
        date: new Date(forecast.list[day * 8].dt * 1000).toLocaleDateString("en-us", {weekday: "short", month: "short", day: "numeric"}),
        time: new Date(forecast.list[day * 8].dt * 1000).toLocaleTimeString("en-us", {hour: "numeric"}) + " to " + new Date(forecast.list[day * 8 + 7].dt * 1000).toLocaleTimeString("en-us", {hour: "numeric"}),
        weather: forecast.list[day * 8].weather[0].main,
        feels_like: Math.round(feels_like_sum / 8),
        humidity: Math.round(humidity_sum / 8),
        wind: Math.round(wind_sum / 8),
    }
}

function getHours(forecast, q, path) {
    let hours = [];

    for (let i = 0; i < 8; i++) {
        let hour = forecast.list[i + parseInt(q.day || 0) * 8];

        let q2 = Object.assign({}, q, {hour: i.toString()});

        let selected = q.hour === q2.hour;

        if (selected) {
            delete q2.hour;
        }

        hours.push({
            time: new Date(hour.dt * 1000).toLocaleTimeString("en-us", {hour: "numeric"}),
            icon: hour.weather[0].icon,
            icon_alt: hour.weather[0].description,
            temp: Math.round(hour.main.temp),
            link: getRelativeLinkFromQueryParams(q2, path),
            selected: selected ? "selected" : "",
        });
    }

    return hours;
}

function getDays(forecast, q, path) {
    let days = []

    for (let i = 0; i < 5; i++) {
        let day = forecast.list[i * 8];

        let temps = [];
        for (let j = 0; j < 8; j++) {
            temps[j] = forecast.list[i * 8 + j].main.temp;
        }

        let q2 = Object.assign({}, q, {day: i.toString()});
        delete q2.hour;

        let selected = q.day === q2.day;

        if (selected) {
            delete q2.day;
        }

        days.push({
            date: new Date(day.dt * 1000).toLocaleDateString("en-us", {weekday: "short", month: "short", day: "numeric"}),
            weather: day.weather[0].main,
            high: Math.round(Math.max.apply(Math, temps)),
            low: Math.round(Math.min.apply(Math, temps)),
            icon: day.weather[0].icon,
            icon_alt: day.weather[0].description,
            number: i.toString(),
            link: getRelativeLinkFromQueryParams(q2, path),
            selected: selected ? "selected" : "",
        });
    }

    return days;
}

app.get("/", (req, res) => {
    res.render("home", {
        navbar_selected_item: "home",
        details: getDetails(current, forecast, req.query),
        hours: getHours(forecast, req.query, req.path),
        days: getDays(forecast, req.query, req.path),
    });
});

app.get("/places", (req, res) => {
    res.render("places", {
        navbar_selected_item: "places",
        navbar_button_hidden: "false",
        navbar_button_text: "Add place",
        // Temp
        details: getDetails(current, forecast, req.query),
        hours: getHours(forecast, req.query, req.path),
        days: getDays(forecast, req.query, req.path),
    });
});

app.get("/journal", (req, res) => {
    res.render("journal", {
        navbar_selected_item: "journal",
        navbar_button_hidden: "false",
        navbar_button_text: "New entry",
    });
});

app.get("/settings", (req, res) => {
    res.render("settings", {
        navbar_selected_item: "settings",
    });
});

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
