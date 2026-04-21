export interface FetchResult {
	title: string;
	content: string;
	url: string;
}

export async function fetchUrlContent(): Promise<FetchResult> {
	throw new Error("URL best-effort fetching is planned for M2 and is not implemented in the M0 skeleton.");
}
