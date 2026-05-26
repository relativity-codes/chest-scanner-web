const payload = [
  {
    chestName: "Legendary Chest",
    fromPlayer: "PlayerName",
    source: "Gifts",
    time: "2026-05-26T21:22:00.000Z",
    gameDay: "chests_2026-05-26",
    originalTimer: "15h 2m"
  }
];

fetch('http://localhost:3000/api/chests/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
.then(res => res.json().then(data => ({ status: res.status, data })))
.then(console.log)
.catch(console.error);
