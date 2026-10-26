export interface IRegisterUser {
	name: string;
	email: string;
	password: string;
	currency?: string;
	enabledTabs?: string;
}

export interface ILoginUser {
	email: string;
	password: string;
}

export interface IAuthResponse {
	user: {
		id: string;
		name: string;
		email: string;
		currency: string;
		enabledTabs?: string;
		createdAt: Date;
	};
	token: string;
}
