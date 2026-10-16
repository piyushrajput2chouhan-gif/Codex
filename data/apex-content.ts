export const site = {
  brand: "Apex Auto Captures",
  owner: "Ibrahim",
  instagram: { handle: "@apexautocaptures", url: "https://www.instagram.com/apexautocaptures/" },
  email: "apexautocaptures@gmail.com",
  phone: { display: "+91 97014 14074", wa: "919701414074" },
};

export const waLink = (text?: string) =>
  `https://wa.me/${site.phone.wa}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const defaultWa =
  "Hi Apex Auto Captures! I'm interested in booking a car or café photography/videography project. I'd like to discuss my requirements and get a quotation.";

/** Square photos for the puzzle gallery. Files live in public/work. Captions say only what the photo shows. */
export const work = {
  cars: [
    { src: "work/car-orange-front.webp", title: "Orange Lamborghini", caption: "Front view from above", alt: "Orange Lamborghini seen from the front and above" },
    { src: "work/car-black-bmw.webp", title: "Black BMW M2", caption: "Parked outdoors", alt: "Black BMW M2 parked outdoors" },
    { src: "work/car-orange-v10.webp", title: "Orange Lamborghini", caption: "V10 badge on the engine cover", alt: "V10 badge on the engine cover of an orange Lamborghini" },
    { src: "work/car-blue-bmw.webp", title: "Blue BMW M2", caption: "Front three-quarter view", alt: "Blue BMW M2 in front of a glass building" },
    { src: "work/car-orange-light.webp", title: "Orange Lamborghini", caption: "Headlight and bonnet", alt: "Headlight and bonnet of an orange Lamborghini" },
    { src: "work/car-huracan.webp", title: "Lamborghini Huracán", caption: "Black, head on", alt: "Black Lamborghini Huracán seen from the front" },
    { src: "work/car-orange-rear.webp", title: "Orange Lamborghini", caption: "Rear, beside the café sign", alt: "Rear of an orange Lamborghini next to a café sign" },
  ],
  cafes: [
    { src: "work/cafe-pineapple-mojito.webp", title: "Pineapple mojito", caption: "Drinks", alt: "Pineapple and mint mojito in a stemmed glass" },
    { src: "work/cafe-interior.webp", title: "The dining room", caption: "Interiors", alt: "Café dining room under a tree of hanging bulbs" },
    { src: "work/cafe-brownie.webp", title: "Brownie and ice cream", caption: "Food", alt: "Brownie with ice cream on a wooden plate" },
    { src: "work/cafe-berry-mojito.webp", title: "Berry cooler", caption: "Drinks", alt: "Red berry drink in a jar with grapefruit and mint" },
    { src: "work/cafe-bar.webp", title: "The bar", caption: "Interiors", alt: "Café bar with a lit sign and hanging plants" },
    { src: "work/cafe-sushi.webp", title: "Sushi plate", caption: "Food", alt: "Sushi rolls with sauce on a white board" },
    { src: "work/cafe-mojito-hands.webp", title: "Handing over the drink", caption: "Moments", alt: "A bartender in a blue glove handing over a mojito" },
    { src: "work/cafe-dosa-pot.webp", title: "Clay pot and dosa", caption: "Food", alt: "Clay pot dish with a puffed top and a plate of dosa" },
    { src: "work/cafe-spinach-dish.webp", title: "Crispy spinach dish", caption: "Food", alt: "White bowl of crispy spinach with a spicy topping" },
    { src: "work/cafe-chandelier.webp", title: "Under the lights", caption: "Interiors", alt: "Hanging bulbs on a metal tree in a café" },
  ],
};

export const services = {
  cars: [
    ["Automotive Photography", "Stills that show the lines, stance and presence of the car."],
    ["Cinematic Car Films", "Short films that give a car movement and mood."],
    ["Rolling Shots", "Cars shot in motion, where safe conditions allow."],
    ["Detail and Close-Up Photography", "Badges, lights, wheels and the small things that make a car."],
    ["Reels and Social Content", "Vertical clips cut for Instagram."],
  ],
  cafes: [
    ["Food and Drink Photography", "Plates and glasses shot to look as good as they taste."],
    ["Interior and Ambience Photography", "The room, the light and the mood."],
    ["Café Reels and Social Content", "Short vertical clips for Instagram."],
    ["Launch and Promotional Content", "Content for a new menu, an opening or an offer."],
    ["Custom Café Project", "Something else in mind? Tell us about it."],
  ],
} as const;
