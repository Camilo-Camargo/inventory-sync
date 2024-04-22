import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { parse } from "csv-parse"

const WORDPRESS_CONSUMER_KEY = process.env.WORDPRESS_CONSUMER_KEY
const WORDPRESS_CONSUMER_SECRET = process.env.WORDPRESS_COSUMER_SECRET
const WORDPRESS_USER_NAME = process.env.WORDPRESS_USER_NAME
const WORDPRESS_USER_PASSWORD = process.env.WORDPRESS_USER_PASSWORD
const WORDPRESS_API_URL = process.env.WORDPRESS_API_URL

const SEGMENTATION_PATH = "./data/segmentation.csv"
const api = new WooCommerceRestApi({
  url: WORDPRESS_API_URL as string,
  consumerKey: WORDPRESS_CONSUMER_KEY as string,
  consumerSecret: WORDPRESS_CONSUMER_SECRET as string,
  version: "wc/v3"
});


// Segmentation
const categoriesFields = ['Categorias'];
const tagsField = ['Etiquetas'];

const segmentationFile = Bun.file(SEGMENTATION_PATH);
const segmentationText = await segmentationFile.text();

const segmentation: any = {};
const segmentationStream = parse(segmentationText, { columns: true, skipEmptyLines: true, groupColumnsByName: true });
segmentationStream.on('data', (data) => {
  for (const [key, value] of Object.entries(data)) {
    if (!(key in segmentation)) segmentation[key] = [value];
    else if (value !== "") segmentation[key].push(value);
  }
});

segmentationStream.on('end', async () => {
  const remoteTags = await api.get('products/tags', { per_page: 100 });
  const remoteTagsData = await remoteTags.data;
  const remoteTagNames = remoteTagsData.map((remoteTag) => {
    return remoteTag.name
  });


  const remoteCategoriesRes = await api.get('products/categories', { per_page: 100 });
  const remoteCategoriesData = await remoteCategoriesRes.data;
  const remoteCategoriesNames = remoteCategoriesData.map((remoteCategory) => {
    return remoteCategory.name
  });

  const categories: Array<{ name: string }> = [];
  const tags: Array<{ name: string }> = [];
  for (const key of Object.keys(segmentation)) {
    if (categoriesFields.includes(key)) {
      for (const category of segmentation[key]) {
        if (!remoteCategoriesNames.includes(category)) {
          categories.push({ name: category });
        }
      }
    } else if (tagsField.includes(key)) {
      for (const tag of segmentation[key]) {
        if (!remoteTagNames.includes(tag)) {
          tags.push({ name: tag });
        }
      }
    }
  }

  if (categories.length > 1) {
    await api.post('products/categories/batch', {
      create: categories
    });

    const remoteCategoriesSavedRes = await api.get('products/categories', { per_page: 100 });
    const remoteCategoriesSavedData = await remoteCategoriesSavedRes.data;
    const remoteCategoriesSaved = remoteCategoriesSavedData.map((category) => (category.name))

    if (includesArray(categories.map((c) => c.name), remoteCategoriesSaved)) {
      console.info("Categories was saved successfully");
    }
  } else {
    console.info("Categories are sync.");
  }

  if (tags.length > 1) {
    await api.post('products/tags/batch', {
      create: tags
    });

    const remoteTagsSavedRes = await api.get('products/tags', { per_page: 100 });
    const remoteTagsSavedData = await remoteTagsSavedRes.data;
    const remoteTagsSaved = remoteTagsSavedData.map((tag) => (tag.name))

    if (includesArray(tags.map((c) => c.name), remoteTagsSaved)) {
      console.info("Tags was saved successfully");
    }
  } else {
    console.info("Tags are sync.");
  }
});


function includesArray(a: Array<string>, b: Array<string>): boolean {
  const dictA: { [key: string]: number; } = {}
  const dictB: { [key: string]: number; } = {}

  for (let i = 0; i < a.length; i++) {
    if (!(a[i] in dictA)) dictA[a[i]] = 1;
    else dictA[a[1]]++
  }

  for (let i = 0; i < b.length; i++) {
    if (!(b[i] in dictB)) dictB[b[i]] = 1;
    else dictB[b[1]]++
  }

  let count = 0;
  for (const key in dictA) {
    if (key in dictB) count++;
  }

  if (count != a.length) return false;
  return true;
}

