import {
	IPollFunctions,
} from 'n8n-core';
import {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
} from 'n8n-workflow';
import {
	apiRequestAllItems,
} from './GenericFunction';
import * as moment from 'moment';


export class StackbyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Stackby Trigger',
		name: 'stackbyTrigger',
		group: ['trigger'],
		version: 1,
		description: 'Trigger for stackby',
		defaults: {
			name: 'Stackby Trigger',
			color: '#00FF00',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'stackbyApiKey',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Stack ID',
				name: 'stackId',
				type: 'string',
				default: '',
				required: true,
				description: 'The ID of this base.',
			},
			{
				displayName: 'Table',
				name: 'table',
				type: 'string',
				default: '',
				description: 'The name of table to access.',
				required: true,
			},
			{
				displayName: 'Trigger Field',
				name: 'triggerField',
				type: 'string',
				default: '',
				description: `A Created Time or Last Modified Time field that will be used to sort records. <br>
				If you do not have a Created Time or Last Modified Time field in your schema, please create one,<br>
				because without this field trigger will not work correctly.`,
				required: true,
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Fields',
						name: 'fields',
						type: 'string',
						default: '',
						description: `Fields to be included in the response.<br>
						Multiple ones can be set separated by comma. Example: name,id.<br>
						By default just the trigger field will be included.`,
					},
					{
						displayName: 'View ID',
						name: 'viewId',
						type: 'string',
						default: '',
						description: 'The name or ID of a view in the table. If set, only the records in that view will be returned.',
					},
				],
			},
		],
	};


	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {

		const webhookData = this.getWorkflowStaticData('node');

		const qs: IDataObject = {};

		const additionalFields = this.getNodeParameter('additionalFields') as IDataObject;

		const base = this.getNodeParameter('stackId') as string;

		const table = this.getNodeParameter('table') as string;

		const triggerField = this.getNodeParameter('triggerField') as string;

		const endpoint = `rowlist/${base}/${table}`;

		const now = moment().utc().format();

		const startDate = webhookData.lastTimeChecked as string || now;

		const endDate = now;

		if (additionalFields.viewId) {
			qs.view = additionalFields.viewId;
		}

		if (additionalFields.fields) {
			qs['fields[]'] = (additionalFields.fields as string).split(',');
		}

		qs.filterByFormula = `IS_AFTER({${triggerField}}, DATETIME_PARSE("${startDate}", "YYYY-MM-DD HH:mm:ss"))`;

		if (additionalFields.formula) {
			qs.filterByFormula = `AND(${qs.filterByFormula}, ${additionalFields.formula})`;
		}

		if (this.getMode() === 'manual') {
			delete qs.filterByFormula;
			qs.maxRecords = 1;
		}

		const { records } = await apiRequestAllItems.call(this, 'GET', endpoint, {}, qs);

		webhookData.lastTimeChecked = endDate;

		if (Array.isArray(records) && records.length) {
			if (this.getMode() === 'manual' && records[0].fields[triggerField] === undefined) {
				throw new Error(`The Field "${triggerField}" does not exist.`);
			}

			return [this.helpers.returnJsonArray(records)];
		}

		return null;
	}
}
